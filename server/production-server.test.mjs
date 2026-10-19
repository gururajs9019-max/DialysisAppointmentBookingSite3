import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { access } from "node:fs/promises";
import net from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
let child;
let stderr = "";
try {
  child = spawn(process.execPath, ["server/index.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      // The home-page smoke test does not authenticate or query the database.
      // Forward the configured value without printing it.
      SESSION_SECRET: process.env.SESSION_SECRET,
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
  child.stderr.on("data", chunk => { stderr += chunk.toString(); });

  const deadline = Date.now() + 10_000;
  let response;
  while (Date.now() < deadline) {
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
  await runProductionIntegration(`http://127.0.0.1:${port}`);
  await runProductionIntegration(`http://127.0.0.1:${port}`, "server/prescription-concurrency.test.mjs");
  await runProductionIntegration(`http://127.0.0.1:${port}`, "server/staff-gaps.test.mjs");
  await runProductionIntegration(`http://127.0.0.1:${port}`, "server/staff-backend-gaps.test.mjs");
  console.log("production server smoke test passed");
} finally {
  if (child && child.exitCode === null) {
    child.kill("SIGTERM");
    await Promise.race([once(child, "exit"), sleep(5_000)]);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
}