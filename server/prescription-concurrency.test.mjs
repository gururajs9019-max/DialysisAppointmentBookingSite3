import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { runPrescriptionConflictUiTest } from "./prescription-conflict-ui.mjs";

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:5000";
const run = `RX-CONFLICT-${randomUUID().slice(0, 12)}`;
const db = new Pool({ connectionString: process.env.DATABASE_URL });
const ids = [];
let prescriptionId, patientId;

async function request(path, { method = "GET", body, cookie } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, payload: await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
async function expectStatus(promise, status, message) {
  const result = await promise;
  assert.equal(result.status, status, message || result.payload.error);
  return result.payload;
}
async function login(role, password) {
  const result = await request("/api/auth/login", { method: "POST", body: { role, identifier: `${role}1`, password } });
  assert.equal(result.status, 200, `${role} login must succeed`);
  return result.cookie;
}

try {
  const admin = await login("admin", process.env.STAFF_ADMIN_PASSWORD);
  const doctor = await login("doctor", process.env.STAFF_DOCTOR_PASSWORD);
  const { patient } = await expectStatus(request("/api/patients", {
    method: "POST", cookie: admin, body: { uhid: `${run}-NEG`, name: `${run} Patient` },
  }), 201);
  patientId = patient.id; ids.push(patientId);
  const { prescription } = await expectStatus(request("/api/prescriptions", {
    method: "POST", cookie: doctor, body: {
      patientId, diagnosis: "Test diagnosis", dialysisRx: { duration: "4 Hours", bloodFlow: "300" },
      medications: [{ name: "Test medication", dose: "1", frequency: "Daily", route: "PO" }], notes: "Initial",
      // Reading must always use the authoritative DB version, not JSON metadata.
      version: 999,
    },
  }), 201);
  prescriptionId = prescription.id; ids.push(prescriptionId);
  const path = `/api/prescriptions/${prescriptionId}`;
  const current = async () => (await expectStatus(request("/api/prescriptions", { cookie: admin }), 200)).prescriptions.find(rx => rx.id === prescriptionId);
  const history = async () => (await expectStatus(request(`${path}/history`, { cookie: admin }), 200)).history;
  const sideEffects = async () => (await db.query(`SELECT
    (SELECT count(*)::int FROM prescription_versions WHERE prescription_id=$1) versions,
    (SELECT count(*)::int FROM audit_logs WHERE entity_id=$1 AND action='prescription.revise') audits,
    (SELECT count(*)::int FROM notifications WHERE detail LIKE $2 AND message='Prescription revised') notifications`,
    [prescriptionId, `%${run}%`])).rows[0];
  const recipientCounts = Object.fromEntries((await db.query("SELECT role,count(*)::int count FROM portal_users GROUP BY role")).rows.map(row => [row.role,row.count]));
  assert.equal((await current()).version, 1, "clinical JSON must never override the DB version");

  const beforeInvalid = await sideEffects();
  for (const baseVersion of [undefined, null, 0, -1, 1.5, "1", true, 9007199254740992]) {
    await expectStatus(request(path, { cookie: admin, method: "PATCH", body: { baseVersion, notes: "invalid" } }), 400, "a valid base version is mandatory");
  }
  assert.deepEqual(await sideEffects(), beforeInvalid, "invalid requests must have no side effects");
  await expectStatus(request(path, { method: "PATCH", body: { baseVersion: 1 } }), 401, "staff authentication remains mandatory");
  await expectStatus(request(`/api/prescriptions/${randomUUID()}`, { cookie: admin, method: "PATCH", body: { baseVersion: 1 } }), 404);

  for (const [winner, loser] of [[admin, doctor], [doctor, admin]]) {
    const base = await current(), snapshots = await history(), effects = await sideEffects();
    const notes = `${run} winner v${base.version}`;
    await expectStatus(request(path, { cookie: winner, method: "PATCH", body: { baseVersion: base.version, notes } }), 200);
    const stale = await expectStatus(request(path, { cookie: loser, method: "PATCH",
      body: { baseVersion: base.version, notes: `${run} stale draft` } }), 409, "stale staff draft must not overwrite a peer");
    assert.equal(stale.code, "PRESCRIPTION_VERSION_CONFLICT");
    assert.equal(stale.currentVersion, base.version + 1);
    assert.equal((await current()).notes, notes);
    assert.deepEqual((await history()).slice(0, snapshots.length), snapshots, "old snapshots must remain immutable");
    const after = await sideEffects();
    for (const key of ["versions", "audits", "notifications"]) {
      const increment = key === "notifications" ? recipientCounts[winner === admin ? "doctor" : "admin"] : 1;
      assert.equal(after[key], effects[key] + increment, `rejected save must not add ${key}`);
    }
    await expectStatus(request(path, { cookie: loser, method: "PATCH",
      body: { baseVersion: base.version + 1, notes: `${run} reviewed draft` } }), 200, "reviewing a fresh base must allow recovery");
  }

  const base = await current(), effects = await sideEffects();
  const simultaneous = await Promise.all([admin, doctor].map((cookie, i) => request(path, {
    cookie, method: "PATCH", body: { baseVersion: base.version, notes: `${run} simultaneous ${i}`, patientId: "untrusted" },
  })));
  assert.deepEqual(simultaneous.map(r => r.status).sort(), [200, 409], "row lock and version check must allow exactly one simultaneous writer");
  const after = await sideEffects(), winnerIndex = simultaneous.findIndex(r => r.status === 200);
  for (const key of ["versions", "audits", "notifications"]) {
    const increment = key === "notifications" ? recipientCounts[winnerIndex === 0 ? "doctor" : "admin"] : 1;
    assert.equal(after[key], effects[key] + increment);
  }
  assert.equal((await current()).notes, `${run} simultaneous ${winnerIndex}`);
  const snapshot = (await history()).at(-1).snapshot;
  assert.ok(!Object.hasOwn(snapshot, "baseVersion"), "base version must not enter clinical snapshots");
  assert.notEqual(snapshot.patientId, "untrusted", "revision must not change identity metadata");
  await runPrescriptionConflictUiTest({ baseUrl, patient, prescriptionId });
  console.log("prescription concurrency tests passed (simultaneous Administrator/Doctor saves, validation, side effects, immutable history)");
} finally {
  try {
    await db.query("DELETE FROM audit_logs WHERE entity_id=ANY($1::text[])", [ids]);
    await db.query("DELETE FROM notifications WHERE detail LIKE $1", [`%${run}%`]);
    if (prescriptionId) {
      await db.query("DELETE FROM prescription_versions WHERE prescription_id=$1", [prescriptionId]);
      await db.query("DELETE FROM prescriptions WHERE id=$1", [prescriptionId]);
    }
    if (patientId) await db.query("DELETE FROM patients WHERE id=$1", [patientId]);
  } finally { await db.end(); }
}
