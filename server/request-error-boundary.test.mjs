import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { withRequestErrorBoundary } from "./request-error-boundary.mjs";
import { malformedRequests, rawHttp } from "./raw-http.test-helper.mjs";

const logs = [];
const originalError = console.error;
console.error = (...args) => logs.push(args);
const server = createServer(withRequestErrorBoundary(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === "/reject") {
    // Discard any pending success headers, including credentials and lengths.
    res.setHeader("Set-Cookie", "private-cookie-marker");
    res.setHeader("Content-Length", "999");
    throw new Error("private-error-marker");
  }
  if (url.pathname === "/partial") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.write("partial");
    // Ensure the client sees committed headers before the async failure.
    await new Promise(resolve => setTimeout(resolve, 20));
    throw new Error("private-error-marker");
  }
  if (url.pathname === "/ended") {
    res.end("complete");
    await new Promise(resolve => setImmediate(resolve));
    throw new Error("private-error-marker");
  }
  if (url.pathname === "/destroyed") {
    res.destroy();
    throw new Error("private-error-marker");
  }
  res.end("healthy");
}));

try {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  const request = path => rawHttp(port, `GET ${path} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n`);
  const healthy = async () => assert.match(await request("/"), /200 OK[\s\S]*healthy/);
  for (const input of malformedRequests()) {
    const response = await rawHttp(port, input);
    assert.match(response, /^HTTP\/1.1 500 /);
    assert.match(response, /Cache-Control: no-store/i);
    assert.match(response, /Unexpected server error\./);
    assert.doesNotMatch(response, /private-|TypeError|ERR_INVALID_URL/);
    await healthy();
  }
  const rejected = await request("/reject");
  assert.match(rejected, /^HTTP\/1.1 500 /);
  assert.doesNotMatch(rejected, /Set-Cookie|Content-Length: 999|private-/i);
  const partial = await request("/partial");
  assert.match(partial, /^HTTP\/1.1 200 /);
  assert.equal((partial.match(/HTTP\/1.1/g) || []).length, 1);
  assert.doesNotMatch(partial, /Unexpected server error|0\r\n\r\n$/);
  await healthy();
  assert.match(await request("/ended"), /complete$/);
  assert.equal(await request("/destroyed"), "");
  await healthy();

  // Also exercise synchronous throws and a failure while sending the fallback.
  let destroyed = false;
  await withRequestErrorBoundary(() => { throw new Error("private-error-marker"); })({}, {
    getHeaderNames() { throw new Error("private-write-marker"); },
    destroy() { destroyed = true; },
  });
  assert.ok(destroyed);
  assert.equal(logs.length, malformedRequests().length + 5);
  for (const entry of logs) assert.deepEqual(entry, ["Unexpected request handler failure."]);
} finally {
  console.error = originalError;
  await new Promise(resolve => server.close(resolve));
}
console.log("request error boundary raw HTTP regressions passed");
