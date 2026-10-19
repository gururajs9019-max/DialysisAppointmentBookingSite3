import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { format } from "node:util";
import { httpError } from "./api-errors.mjs";
import { withRequestErrorBoundary } from "./request-error-boundary.mjs";

// Exercise the real API catch without touching a database or using credentials.
// Faults are injected only by this test's HTTP wrapper during body iteration.
process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "synthetic-api-error-test-secret";
const { api } = await import("./index.mjs");
const markers = {
  patient: "private-patient-name-marker",
  uhid: "private-patient-uhid-marker",
  clinical: "private-clinical-note-marker",
  email: "private-account-email-marker",
  password: "private-password-marker",
  cookie: "private-cookie-marker",
  token: "private-authorization-marker",
  query: "private-url-query-marker",
  code: "private-arbitrary-code-marker",
};
function databaseError(code) {
  return Object.assign(new Error(`${markers.clinical} ${markers.email}`), {
    code,
    detail: `Failing row contains (${Object.values(markers).join(", ")}).`,
    where: `SQL query: INSERT INTO clinical_notes VALUES ('${markers.clinical}')`,
    query: `UPDATE portal_users SET password_hash='${markers.password}'`,
    parameters: Object.values(markers),
    table: markers.patient,
    column: markers.uhid,
    schema: markers.email,
    constraint: markers.password,
    stack: `Error: ${markers.clinical}\n    at ${markers.token}`,
    cause: new Error(`postgres://account:${markers.password}@private-host/database`),
  });
}
const unexpected = [
  { error: databaseError("23505"), status: 500, code: "23505" },
  { error: databaseError("42P01"), status: 503, code: "42P01" },
  { error: databaseError("ECONNREFUSED"), status: 500, code: "ECONNREFUSED" },
  { error: databaseError(markers.code), status: 500, code: "UNEXPECTED" },
  { error: Object.assign(databaseError(markers.code), { statusCode: 409, code: "PRESCRIPTION_VERSION_CONFLICT", currentVersion: markers.clinical }), status: 500, code: "UNEXPECTED" },
  { error: Object.assign(databaseError(markers.code), { code: { detail: markers.clinical } }), status: 500, code: "UNEXPECTED" },
  { error: httpError(503, markers.clinical), status: 503, code: "UNEXPECTED" },
  { error: httpError(999, markers.clinical), status: 500, code: "UNEXPECTED" },
  { error: markers.password, status: 500, code: "UNEXPECTED" },
  { error: null, status: 500, code: "UNEXPECTED" },
  { error: undefined, status: 500, code: "UNEXPECTED" },
];
const expected = [
  { status: 400, body: { error: "Invalid diagnosis." } },
  { status: 401, body: { error: "Sign in is required." } },
  { status: 403, body: { error: "You are not authorised for this action." } },
  { status: 404, body: { error: "Patient was not found." } },
  { status: 409, body: { error: "Only active patients can be scheduled." } },
  { status: 413, body: { error: "Request body is too large." } },
  ...["PRESCRIPTION_VERSION_CONFLICT", "CLINICAL_NOTE_VERSION_CONFLICT"].map(code => ({
    status: 409,
    body: { error: "Another staff member saved a newer record.", code, currentVersion: 4 },
  })),
];
const faults = new Map(unexpected.map((test, index) => [`unexpected-${index}`, test.error]));
expected.forEach((test, index) => {
  const error = httpError(test.status, test.body.error);
  if (test.body.code) Object.assign(error, { code: test.body.code, currentVersion: test.body.currentVersion });
  faults.set(`expected-${index}`, error);
});
const logs = [];
const renderedLogs = [];
const originalError = console.error;
console.error = (...args) => { logs.push(args); renderedLogs.push(format(...args)); };
const server = createServer(withRequestErrorBoundary(async (req, res) => {
  const faultKey = req.headers["x-test-fault"];
  if (faults.has(faultKey)) {
    req.iterator = async function* () {
      yield Buffer.from(JSON.stringify(markers));
      throw faults.get(faultKey);
    };
  }
  const handled = await api(req, res, new URL(req.url, "http://localhost"));
  assert.equal(handled, true);
}));

try {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  async function request(faultKey, body = JSON.stringify(markers)) {
    const response = await fetch(`${baseUrl}/api/auth/login?detail=${markers.query}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": markers.cookie,
        "Authorization": `Bearer ${markers.token}`,
        ...(faultKey ? { "X-Test-Fault": faultKey } : {}),
      },
      body,
      signal: AbortSignal.timeout(5_000),
    });
    assert.equal(response.headers.get("cache-control"), "no-store");
    return { status: response.status, body: await response.json() };
  }
  async function healthy() {
    const response = await fetch(`${baseUrl}/api/auth/logout`, { method: "POST", signal: AbortSignal.timeout(5_000) });
    assert.equal(response.status, 204, "the same server must keep handling requests");
    await response.text();
  }
  for (const [index, test] of unexpected.entries()) {
    assert.deepEqual(await request(`unexpected-${index}`), { status: test.status, body: { error: "Unexpected server error." } });
    assert.deepEqual(logs.at(-1), ["Unexpected API failure.", { status: test.status, code: test.code }]);
    await healthy();
  }
  const logCount = logs.length;
  for (const [index, test] of expected.entries()) {
    assert.deepEqual(await request(`expected-${index}`), { status: test.status, body: test.body });
  }
  assert.deepEqual(await request(undefined, "{"), { status: 400, body: { error: "Request body must be valid JSON." } });
  assert.equal(logs.length, logCount, "expected validation, authorization and conflict errors must not be logged as unexpected");
  const parallel = await Promise.all(Array.from({ length: 8 }, () => request("unexpected-0")));
  for (const response of parallel) {
    assert.deepEqual(response, { status: 500, body: { error: "Unexpected server error." } });
  }
  assert.equal(logs.length, unexpected.length + parallel.length, "log each unexpected error once");
  for (const entry of logs) {
    assert.equal(entry.length, 2);
    assert.equal(entry[0], "Unexpected API failure.");
    assert.deepEqual(Object.keys(entry[1]).sort(), ["code", "status"]);
  }
  for (const marker of Object.values(markers)) {
    assert.ok(!renderedLogs.join("\n").includes(marker), `logs must not expose ${marker}`);
  }
  assert.doesNotMatch(renderedLogs.join("\n"), /postgres:\/\/|Failing row|INSERT INTO|UPDATE portal_users|password_hash|private-host/);
  await healthy();
} finally {
  console.error = originalError;
  await new Promise(resolve => server.close(resolve));
}
console.log("API error privacy tests passed (safe diagnostics, generic server errors, preserved validation/auth/conflicts, same-process recovery)");
