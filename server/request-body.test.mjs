import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import net from "node:net";
import { Pool } from "pg";
import { rawHttp } from "./raw-http.test-helper.mjs";

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:5000";
const url = new URL(baseUrl);
assert.ok(["localhost", "127.0.0.1"].includes(url.hostname), "run request-body tests against a local test server, never the published site");
const port = Number(url.port || 80);
const limit = 1_000_000;
const marker = "private-request-body-marker";
const run = `BODY-${randomUUID().slice(0, 12)}`;
const db = new Pool({ connectionString: process.env.DATABASE_URL });
let patientId;

function headers(path, framing, cookie) {
  return `POST ${path}?detail=${marker} HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\n${framing}\r\n${cookie ? `Cookie: ${cookie}\r\n` : ""}Connection: close\r\n\r\n`;
}
function chunk(body, final = true) {
  return Buffer.concat([Buffer.from(`${body.length.toString(16)}\r\n`), body, Buffer.from(`\r\n${final ? "0\r\n\r\n" : ""}`)]);
}
async function expectTooLarge(framing, body = Buffer.alloc(0), path = "/api/auth/login", cookie) {
  const response = await rawHttp(port, Buffer.concat([Buffer.from(headers(path, framing, cookie)), body]));
  assert.match(response, /^HTTP\/1.1 413 /, "oversized submissions should return a usable 413 response");
  assert.match(response, /Connection: close/i, "an oversized upload must not keep consuming the connection");
  assert.match(response, /Request body is too large\./);
  assert.ok(!response.includes(marker), "responses must not echo submitted details");
}
async function api(path, cookie, method = "GET", body, expected = 200) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(cookie ? { Cookie: cookie } : {}), "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(response.status, expected, `${method} ${path} should remain available`);
  return response.json();
}
async function login(role) {
  const password = role === "admin" ? process.env.STAFF_ADMIN_PASSWORD : process.env.STAFF_DOCTOR_PASSWORD;
  assert.ok(password, "request-body regression tests require configured staff test passwords");
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, identifier: role === "admin" ? "admin1" : "doctor1", password }),
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(response.status, 200, "staff must still be able to sign in");
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie, "successful login should issue a session");
  const { user } = await response.json();
  return { cookie, userId: user.id, role };
}
async function abandon(path, framing, body, cookie, halfClose = false, method = "POST") {
  await new Promise((resolve, reject) => {
    const socket = net.connect(port, "127.0.0.1");
    let timer;
    socket.setTimeout(5_000, () => socket.destroy(new Error("Interrupted-upload test timed out")));
    socket.on("data", () => {}); // Half-close may receive the HTTP parser's 400.
    socket.on("error", error => {
      if (error.code !== "ECONNRESET" && error.code !== "EPIPE") reject(error);
    });
    socket.on("close", () => { clearTimeout(timer); resolve(); });
    socket.on("connect", () => {
      const head = headers(path, framing, cookie).replace(/^POST /, `${method} `);
      socket.write(Buffer.concat([Buffer.from(head), body]), () => {
        if (halfClose) socket.end();
        else timer = setTimeout(() => socket.destroy(), 25);
      });
    });
  });
}

try {
  // Reject a clearly oversized declaration without waiting for its body.
  await expectTooLarge(`Content-Length: ${limit + 1}`);
  const ascii = Buffer.from(JSON.stringify({ padding: "x".repeat(limit), marker }));
  const unicode = Buffer.from(JSON.stringify({ padding: "🩺".repeat(260_000), marker }));
  assert.ok(unicode.toString().length < limit && unicode.length > limit, "Unicode fixture must distinguish bytes from JS string length");
  for (const body of [ascii, unicode]) {
    await expectTooLarge(`Content-Length: ${body.length}`, body);
    await expectTooLarge("Transfer-Encoding: chunked", chunk(body));
    // The sender can stop immediately after overflowing the limit.
    await expectTooLarge("Transfer-Encoding: chunked", chunk(body, false));
  }
  const exact = Buffer.from(`{"padding":"${"x".repeat(limit - 14)}"}`);
  assert.equal(exact.length, limit);
  const accepted = await rawHttp(port, Buffer.concat([Buffer.from(headers("/api/auth/login", `Content-Length: ${limit}`)), exact]));
  assert.match(accepted, /^HTTP\/1.1 400 /, "exactly-at-limit JSON must reach normal validation");
  assert.match(accepted, /Invalid role\./);

  const [admin, doctor] = await Promise.all([login("admin"), login("doctor")]);
  async function staffStillAvailable() {
    const home = await fetch(baseUrl, { signal: AbortSignal.timeout(5_000) });
    assert.equal(home.status, 200);
    await home.text();
    for (const staff of [admin, doctor]) {
      const { user } = await api("/api/auth/me", staff.cookie);
      assert.equal(user.id, staff.userId, "existing staff sessions must remain valid");
    }
  }
  patientId = (await api("/api/patients", admin.cookie, "POST", { name: `${run} synthetic`, uhid: run, treatmentStatus: "Active" }, 201)).patient.id;
  const originalNote = (await api("/api/clinical-notes", doctor.cookie, "POST", { patientId, body: `${run} original note` }, 201)).note;
  const edit = Buffer.from(JSON.stringify({ body: `${run} ${marker} incomplete update`, baseVersion: originalNote.version }));
  for (const halfClose of [false, true]) {
    await abandon("/api/auth/login", `Content-Length: ${edit.length + 100}`, edit, undefined, halfClose);
    await abandon("/api/clinical-notes", `Content-Length: ${edit.length + 100}`, edit, doctor.cookie, halfClose);
    await abandon(`/api/clinical-notes/${originalNote.id}`, `Content-Length: ${edit.length + 100}`, edit, doctor.cookie, halfClose, "PATCH");
    await abandon(`/api/clinical-notes/${originalNote.id}`, "Transfer-Encoding: chunked", chunk(edit, false), doctor.cookie, halfClose, "PATCH");
    await staffStillAvailable();
  }
  await Promise.all(Array.from({ length: 12 }, (_, index) => abandon(
    `/api/clinical-notes/${originalNote.id}`,
    index % 2 ? "Transfer-Encoding: chunked" : `Content-Length: ${edit.length + 100}`,
    index % 2 ? chunk(edit, false) : edit,
    doctor.cookie,
    false,
    "PATCH",
  )));
  await expectTooLarge(`Content-Length: ${ascii.length}`, ascii, "/api/clinical-notes", doctor.cookie);
  await expectTooLarge("Transfer-Encoding: chunked", chunk(unicode, false), "/api/clinical-notes", doctor.cookie);
  await staffStillAvailable();
  const { notes } = await api(`/api/patients/${patientId}/clinical-notes`, doctor.cookie);
  assert.equal(notes.length, 1, "interrupted or oversized submissions must not create partial clinical records");
  assert.equal(notes[0].body, originalNote.body);
  assert.equal(notes[0].version, originalNote.version, "interrupted edits must not increment clinical versions");
  const history = await db.query("SELECT count(*)::int AS count FROM audit_logs WHERE entity_id=$1", [originalNote.id]);
  assert.equal(history.rows[0].count, 1, "rejected bodies must not create update audit entries");
  const saved = await api(`/api/clinical-notes/${originalNote.id}`, doctor.cookie, "PATCH", {
    body: `${run} valid follow-up 🩺 नमस्ते`, baseVersion: originalNote.version,
  });
  assert.equal(saved.note.version, originalNote.version + 1, "a subsequent valid staff edit must save normally");
  for (const role of ["admin", "doctor"]) await login(role);
  console.log("request body regressions passed (byte limits, prompt 413s, truncated uploads, disconnect bursts, preserved sessions/records, subsequent staff saves)");
} finally {
  if (patientId) {
    const notes = await db.query("SELECT id FROM clinical_notes WHERE patient_id=$1", [patientId]);
    await db.query("DELETE FROM notifications WHERE patient_id=$1", [patientId]);
    await db.query("DELETE FROM audit_logs WHERE entity_id=ANY($1::text[])", [[patientId, ...notes.rows.map(note => note.id)]]);
    await db.query("DELETE FROM clinical_notes WHERE patient_id=$1", [patientId]);
    await db.query("DELETE FROM patients WHERE id=$1", [patientId]);
  }
  await db.end();
}
