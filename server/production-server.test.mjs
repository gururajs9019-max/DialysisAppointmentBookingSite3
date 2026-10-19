import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, cp, mkdir, mkdtemp, rename, rm, symlink } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { malformedRequests, rawHttp } from "./raw-http.test-helper.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const distIndex = join(root, "dist", "index.html");
await access(distIndex);
if (!process.env.SESSION_SECRET) {
  throw new Error("Production smoke test requires SESSION_SECRET.");
}

async function unusedPort() {
  const socket = net.createServer();
  socket.listen(0, "127.0.0.1");
  await once(socket, "listening");
  const { port } = socket.address();
  await new Promise(resolve => socket.close(resolve));
  return port;
}
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function runProductionIntegration(baseUrl, file = "server/integration.test.mjs") {
  const integration = spawn(process.execPath, [file], {
    cwd: root,
    env: { ...process.env, TEST_BASE_URL: baseUrl },
    stdio: "inherit",
  });
  const [code, signal] = await once(integration, "exit");
  if (code !== 0) {
    throw new Error(`Production integration test failed${signal ? ` (${signal})` : ` (exit ${code})`}.`);
  }
}

const port = await unusedPort();
const staticOnly = process.argv.includes("--static-only");
const fixtureRoot = await mkdtemp(join(tmpdir(), "dialysis-production-server-"));
let child;
let stderr = "";
try {
  // Stay outside Vite's watched project tree, including for broken-file fixtures.
  await symlink(join(root, "node_modules"), join(fixtureRoot, "node_modules"), "dir");
  await cp(join(root, "server"), join(fixtureRoot, "server"), { recursive: true });
  await cp(join(root, "shared"), join(fixtureRoot, "shared"), { recursive: true });
  await cp(join(root, "dist"), join(fixtureRoot, "dist"), { recursive: true });
  child = spawn(process.execPath, ["server/index.mjs"], {
    cwd: fixtureRoot,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      // Static checks do not authenticate or query the database.
      // Forward the configured value without printing it.
      SESSION_SECRET: process.env.SESSION_SECRET,
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
  child.stderr.on("data", chunk => { stderr += chunk.toString(); });

  const deadline = Date.now() + 10_000;
  let response;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) break;
    try {
      response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.ok) break;
    } catch {
      // The child is still binding the socket.
    }
    await sleep(100);
  }
  assert.ok(response?.ok, `production server did not become ready${stderr ? `: ${stderr}` : ""}`);
  const html = await response.text();
  assert.match(html, /id=["']root["']/i, "production root should serve built application HTML");
  assert.ok(!html.includes("/@vite/client"), "production HTML must not include the Vite development client");
  const baseUrl = `http://127.0.0.1:${port}`;
  async function check(path, status, contentType, expectedBody, options) {
    const result = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(5_000), ...options });
    assert.equal(result.status, status, `${path} status`);
    assert.match(result.headers.get("content-type"), contentType, `${path} content type`);
    const body = await result.text();
    if (expectedBody !== undefined) assert.equal(body, expectedBody, `${path} body`);
    assert.equal(child.exitCode, null, "same production process should remain alive");
    assert.equal(child.signalCode, null, "production process should not be terminated");
    return body;
  }
  const originalPid = child.pid;
  for (const input of malformedRequests()) {
    const result = await rawHttp(port, input);
    assert.match(result, /^HTTP\/1.1 500 /, "malformed requests get a generic error");
    assert.match(result, /Unexpected server error\./);
    assert.doesNotMatch(result, /private-|ERR_INVALID_URL|TypeError/);
    await check("/", 200, /text\/html/, html);
    await check("/patient", 200, /text\/html/, html);
    await check("/api/patients", 401, /application\/json/, '{"error":"Sign in is required."}');
    assert.equal(child.pid, originalPid, "recovery must not rely on a replacement process");
  }
  await check("/api/auth/login", 400, /application\/json/, '{"error":"Request body must be valid JSON."}', {
    method: "POST", body: "{", headers: { "Content-Type": "application/json" },
  });
  assert.equal(
    stderr.split("Unexpected request handler failure.").length - 1,
    malformedRequests().length,
    "each unexpected rejection should be logged",
  );
  assert.doesNotMatch(stderr, /private-|ERR_INVALID_URL|TypeError/, "request data must not appear in boundary logs");
  console.log("production malformed-request same-process regressions passed");
  for (const asset of html.matchAll(/(?:src|href)="([^"]+\.(js|css))"/g)) {
    const body = await check(asset[1], 200, asset[2] === "js" ? /text\/javascript/ : /text\/css/);
    assert.ok(body.length > 0, "built asset should have content");
    assert.notEqual(body, html, "built assets must not receive SPA HTML");
  }
  // Both used to commit 200 headers, fail to read, and crash with a second writeHead.
  for (const path of ["/staff/sessions/missing", "/doctor/schedule?date=2026-10-19"]) {
    await check(path, 200, /text\/html/, html);
  }
  const missingAssets = [
    "/assets/missing.js", "/assets/missing.css?cache=old", "/missing.svg",
    "/favicon.ico", "/assets/extensionless", "/assets", "/assets/",
    "/assets/missing-parent/child.js",
  ];
  for (const path of missingAssets) {
    await check(path, 404, /text\/plain/, "Not found");
    await check("/", 200, /text\/html/, html);
  }
  await Promise.all(missingAssets.map(path => check(path, 404, /text\/plain/, "Not found")));
  await check("/staff/sessions/missing", 200, /text\/html/, "", { method: "HEAD" });
  await check("/assets/missing.js", 404, /text\/plain/, "", { method: "HEAD" });
  const unreadableAsset = join(fixtureRoot, "dist", "assets", "unreadable.js");
  await symlink("unreadable.js", unreadableAsset);
  await check("/assets/unreadable.js", 500, /text\/plain/, "Unable to load application");
  await check("/", 200, /text\/html/, html);

  const fixtureIndex = join(fixtureRoot, "dist", "index.html");
  await rename(fixtureIndex, `${fixtureIndex}.saved`);
  try {
    for (const path of ["/", "/staff/sessions/missing", "/index.html"]) {
      await check(path, 500, /text\/plain/, "Unable to load application");
    }
    await check("/assets/missing.js", 404, /text\/plain/, "Not found");
    // A directory in place of the shell exercises another read failure without
    // relying on permission bits (which behave differently under privileged CI).
    await mkdir(fixtureIndex);
    await check("/staff/sessions/missing", 500, /text\/plain/, "Unable to load application");
    await rm(fixtureIndex, { recursive: true });
  } finally {
    await rename(`${fixtureIndex}.saved`, fixtureIndex);
  }
  await check("/", 200, /text\/html/, html);
  await check("/staff/sessions/missing", 200, /text\/html/, html);
  assert.ok(!stderr.includes("ERR_HTTP_HEADERS_SENT"), "file failures must not write headers twice");
  console.log("production static-file regressions passed");
  if (!staticOnly) {
    await runProductionIntegration(baseUrl);
    await runProductionIntegration(baseUrl, "server/prescription-concurrency.test.mjs");
    await runProductionIntegration(baseUrl, "server/staff-gaps.test.mjs");
    await runProductionIntegration(baseUrl, "server/staff-backend-gaps.test.mjs");
    await runProductionIntegration(baseUrl, "server/prescription-creation.test.mjs");
  }
  console.log("production server smoke test passed");
} finally {
  if (child && child.exitCode === null) {
    child.kill("SIGTERM");
    await Promise.race([once(child, "exit"), sleep(5_000)]);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
  await rm(fixtureRoot, { recursive: true, force: true });
}