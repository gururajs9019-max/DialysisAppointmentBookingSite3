import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { verifySchedulingLinksInBrowser } from "./staff-scheduling-ui.mjs";

const base = process.env.TEST_BASE_URL || "http://127.0.0.1:5000";
const db = new Pool({ connectionString: process.env.DATABASE_URL });
const run = `STAFF-${randomUUID().slice(0,8)}`;
const ids = { users: [], patients: [], machines: [], units: [], prescriptions: [], sessions: [] };
const constraint = `test_audit_${randomUUID().replaceAll("-", "")}`;
let constraintInstalled = false;
async function req(path, cookie, method = "GET", body, expected = 200) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  assert.equal(response.status, expected, `${method} ${path}: ${data.error || ""}`);
  return { ...data, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
try {
  const admin = (await req("/api/auth/login", null, "POST", {
    role: "admin", identifier: "admin1", password: process.env.STAFF_ADMIN_PASSWORD,
  })).cookie;
  async function account(role, suffix) {
    const user = (await req("/api/users", admin, "POST", {
      name: `${run} ${suffix}`, email: `${run}-${suffix}@example.test`, role, password: `${run}-Synthetic-123`,
    }, 201)).user;
    ids.users.push(user.id); return user;
  }
  const doctor = await account("doctor", "doctor");
  const inactive = await account("doctor", "inactive");
  await req(`/api/users/${inactive.id}`, admin, "PATCH", { status: "Inactive" });
  const auditActor = await account("admin", "audit");
  const auditCookie = (await req("/api/auth/login", null, "POST", {
    role: "admin", identifier: auditActor.email, password: `${run}-Synthetic-123`,
  })).cookie;
  const unit = (await req("/api/units", admin, "POST", { name: run }, 201)).unit;
  ids.units.push(unit.id);
  const machine = (await req("/api/machines", admin, "POST", {
    unitId: unit.id, code: run, name: run, category: "Negative", status: "available",
  }, 201)).machine;
  ids.machines.push(machine.id);
  const secondUnit = (await req("/api/units", admin, "POST", { name: `${run} second unit` }, 201)).unit;
  ids.units.push(secondUnit.id);
  const secondMachine = (await req("/api/machines", admin, "POST", {
    unitId: secondUnit.id, code: `${run}-second`, name: `${run} second machine`, category: "Negative",
  }, 201)).machine;
  ids.machines.push(secondMachine.id);
  const patientInput = { name: `${run} patient`, uhid: run, treatmentStatus: "Active", treatingNephrologist: doctor.name };
  const patient = (await req("/api/patients", admin, "POST", patientInput, 201)).patient;
  ids.patients.push(patient.id);
  const other = (await req("/api/patients", admin, "POST", { ...patientInput, name: `${run} other`, uhid: `${run}-other` }, 201)).patient;
  ids.patients.push(other.id);
  async function prescription(patientId, diagnosis) {
    const rx = (await req("/api/prescriptions", admin, "POST", { patientId, diagnosis }, 201)).prescription;
    ids.prescriptions.push(rx.id); return rx;
  }
  const rx = await prescription(patient.id, `${run} prescription`);
  const wrongRx = await prescription(other.id, `${run} other prescription`);
  const discontinued = await prescription(patient.id, `${run} discontinued`);
  await req(`/api/prescriptions/${discontinued.id}`, admin, "PATCH", { baseVersion: 1, status: "Discontinued" });
  const date = new Date(Date.now() + 86400000).toISOString().slice(0,10);
  const schedule = { patientId: patient.id, unitId: unit.id, machineId: machine.id, date, slot: "Slot 1" };
  const doctorCookie = (await req("/api/auth/login", null, "POST", {
    role: "doctor", identifier: doctor.email, password: `${run}-Synthetic-123`,
  })).cookie;
  await req("/api/scheduling-options", null, "GET", undefined, 401);
  for (const cookie of [admin, doctorCookie]) {
    const options = await req(`/api/scheduling-options?patientId=${patient.id}`, cookie);
    assert.ok(options.doctors.some(d => d.id === doctor.id));
    assert.ok(!options.doctors.some(d => [inactive.id, auditActor.id].includes(d.id)));
    assert.deepEqual(options.prescriptions.map(p => p.id), [rx.id]);
  }
  for (const invalid of [
    { doctorId: "missing" }, { doctorId: inactive.id }, { doctorId: auditActor.id },
    { doctor: "Unknown doctor" }, { prescriptionId: "missing" },
    { prescriptionId: wrongRx.id }, { prescriptionId: discontinued.id }, { status: "invalid" },
  ]) await req("/api/sessions", admin, "POST", { ...schedule, ...invalid }, 400);
  assert.equal((await db.query("SELECT count(*)::int count FROM dialysis_sessions WHERE patient_id=$1", [patient.id])).rows[0].count, 0);

  const session = (await req("/api/sessions", admin, "POST", {
    ...schedule, doctorId: doctor.id, doctor: "Untrusted display text", prescriptionId: rx.id, status: "called",
  }, 201)).session;
  ids.sessions.push(session.id);
  assert.equal(session.patientId, patient.id, "the selected patient ID is persisted on the session");
  assert.equal(session.doctorId, doctor.id);
  assert.equal(session.doctor, doctor.name, "the directory, not caller text, supplies the doctor name");
  assert.equal(session.prescriptionId, rx.id);
  assert.equal(session.status, "called");
  const cancelledDuplicate = (await req("/api/sessions", admin, "POST", {
    ...schedule, slot: "Slot 2", status: "cancelled",
  }, 201)).session;
  ids.sessions.push(cancelledDuplicate.id);
  const reactivatedDuplicate = await req(`/api/sessions/${cancelledDuplicate.id}`, admin, "PATCH", { status: "waiting" }, 409);
  assert.match(reactivatedDuplicate.error, /already in the Live Schedule/);
  const followingDate = new Date(new Date(`${date}T00:00:00.000Z`).getTime() + 86400000).toISOString().slice(0, 10);
  const nextDaySession = (await req("/api/sessions", admin, "POST", {
    ...schedule, unitId: secondUnit.id, machineId: secondMachine.id, date: followingDate, slot: "Slot 1",
  }, 201)).session;
  ids.sessions.push(nextDaySession.id);
  const duplicateReschedule = await req(`/api/sessions/${session.id}`, admin, "PATCH", {
    status: session.status, machineId: secondMachine.id, unitId: secondUnit.id, date: followingDate, slot: "Slot 2",
  }, 409);
  assert.match(duplicateReschedule.error, /already in the Live Schedule/);
  const row = (await db.query("SELECT patient_id,doctor_id,prescription_id FROM dialysis_sessions WHERE id=$1", [session.id])).rows[0];
  assert.deepEqual(row, { patient_id: patient.id, doctor_id: doctor.id, prescription_id: rx.id });
  assert.equal((await db.query(`SELECT 1 FROM pg_constraint
    WHERE conrelid='dialysis_sessions'::regclass AND conname='session_patient_prescription'`)).rowCount, 1);
  await assert.rejects(
    db.query("UPDATE dialysis_sessions SET prescription_id=$2 WHERE id=$1", [session.id, wrongRx.id]),
    e => e.code === "23503",
    "the database rejects prescriptions belonging to another patient",
  );
  await assert.rejects(db.query("UPDATE dialysis_sessions SET doctor_id='missing' WHERE id=$1", [session.id]), e => e.code === "23503");
  await req("/api/sessions", admin, "POST", schedule, 409);
  await req("/api/sessions", admin, "POST", { ...schedule, slot: "Slot 2" }, 409);

  const racePatient = (await req("/api/patients", admin, "POST", {
    name: `${run} concurrent patient`, uhid: `${run}-race`, treatmentStatus: "Active",
  }, 201)).patient;
  ids.patients.push(racePatient.id);
  const raceAttempts = await Promise.all(["Slot 2", "Slot 3"].map(async slot => {
    const response = await fetch(`${base}/api/sessions`, {
      method: "POST", headers: { "Content-Type": "application/json", Cookie: admin },
      body: JSON.stringify({ ...schedule, patientId: racePatient.id, slot }),
    });
    return { status: response.status, body: await response.json() };
  }));
  assert.deepEqual(raceAttempts.map(result => result.status).sort((a, b) => a - b), [201, 409],
    "concurrent assignments cannot put the same patient into the same day's Live Schedule twice");
  const winningRaceSession = raceAttempts.find(result => result.status === 201).body.session;
  assert.ok(winningRaceSession);
  ids.sessions.push(winningRaceSession.id);
  await req(`/api/sessions/${winningRaceSession.id}`, admin, "PATCH", { status: "cancelled" });
  assert.equal((await req(`/api/sessions/${session.id}`, doctorCookie, "PATCH", { status: "waiting" })).session.status, "waiting");
  assert.equal((await req(`/api/sessions/${session.id}`, doctorCookie, "PATCH", { status: "called", vitals: { bp: "120/80" } })).session.vitals.bp, "120/80");
  const listed = (await req("/api/machines", admin)).machines.find(m => m.id === machine.id);
  assert.equal(listed.next_patient_date.slice(0,10), date, "Called sessions remain in the machine schedule");

  const move = {
    status: "called", machineId: secondMachine.id, unitId: secondUnit.id, date,
    slot: "Slot 3", slotType: "normal", startTime: "4:00 PM", endTime: "8:00 PM", duration: "4 hours",
  };
  await req(`/api/sessions/${session.id}`, doctorCookie, "PATCH", move, 403);
  await req(`/api/sessions/${session.id}`, admin, "PATCH", { ...move, machineId: machine.id }, 400);
  await req(`/api/sessions/${session.id}`, admin, "PATCH", { status: "called", machineId: secondMachine.id }, 400);
  const collision = (await req("/api/sessions", admin, "POST", {
    patientId: other.id, unitId: secondUnit.id, machineId: secondMachine.id, date, slot: "Slot 3",
  }, 201)).session;
  ids.sessions.push(collision.id);
  await req(`/api/sessions/${session.id}`, admin, "PATCH", move, 409);
  const unchanged = (await req("/api/sessions", admin)).sessions.find(item => item.id === session.id);
  assert.equal(unchanged.machineId, machine.id, "a slot conflict must leave the original appointment unchanged");
  assert.equal(unchanged.slot, "Slot 1");
  await req(`/api/sessions/${collision.id}`, admin, "PATCH", { status: "cancelled" });

  const moved = (await req(`/api/sessions/${session.id}`, admin, "PATCH", move)).session;
  assert.equal(moved.id, session.id, "rescheduling must retain the original session ID");
  assert.equal(moved.machineId, secondMachine.id);
  assert.equal(moved.unit, secondUnit.name);
  assert.equal(moved.date, date);
  assert.equal(moved.slot, "Slot 3");
  const moveAudit = await db.query(
    "SELECT metadata FROM audit_logs WHERE action='session.reschedule' AND entity_id=$1 ORDER BY created_at DESC LIMIT 1",
    [session.id],
  );
  assert.equal(moveAudit.rowCount, 1, "rescheduling must be audited");
  assert.equal(moveAudit.rows[0].metadata.before.machineId, machine.id);
  assert.equal(moveAudit.rows[0].metadata.after.machineId, secondMachine.id);
  const machinesAfterMove = (await req(`/api/machines`, admin)).machines;
  assert.equal(machinesAfterMove.find(item => item.id === machine.id)?.status, "available", "moving an appointment must release its old machine");
  assert.equal(machinesAfterMove.find(item => item.id === secondMachine.id)?.status, "scheduled", "the destination machine must be reserved");

  const oldSlotReused = (await req("/api/sessions", admin, "POST", {
    patientId: other.id, unitId: unit.id, machineId: machine.id, date, slot: "Slot 1",
  }, 201)).session;
  ids.sessions.push(oldSlotReused.id);
  const cancelled = (await req(`/api/sessions/${session.id}`, admin, "PATCH", { status: "cancelled" })).session;
  assert.equal(cancelled.id, session.id, "cancellation must retain the appointment row");
  assert.equal(cancelled.status, "cancelled");
  const targetPatient = (await req("/api/patients", admin, "POST", {
    name: `${run} target patient`, uhid: `${run}-target`, treatmentStatus: "Active",
  }, 201)).patient;
  ids.patients.push(targetPatient.id);
  const targetSlotReused = (await req("/api/sessions", admin, "POST", {
    patientId: targetPatient.id, unitId: secondUnit.id, machineId: secondMachine.id, date, slot: "Slot 3",
  }, 201)).session;
  ids.sessions.push(targetSlotReused.id);

  const unassignedPatient = (await req("/api/patients", admin, "POST", {
    name: `${run} unassigned patient`, uhid: `${run}-unassigned`, treatmentStatus: "Active",
  }, 201)).patient;
  ids.patients.push(unassignedPatient.id);
  await req(`/api/patients/${patient.id}`, admin, "PATCH", { treatmentStatus: "Temporarily inactive" });
  assert.equal((await req("/api/sessions", doctorCookie)).sessions.find(s => s.id === session.id).status, "cancelled");
  await req(`/api/patients/${patient.id}`, admin, "PATCH", { treatmentStatus: "Active" });
  // Unassigned sessions remain supported; pre-existing clinical history is not
  // retroactively assigned by guessing names or the latest prescription.
  const unassigned = (await req("/api/sessions", admin, "POST", {
    ...schedule, patientId: unassignedPatient.id, slot: "Slot 2",
  }, 201)).session;
  ids.sessions.push(unassigned.id);
  assert.equal(unassigned.doctorId, null); assert.equal(unassigned.prescriptionId, null);

  // A test-only constraint rejects audits for this synthetic actor. All
  // creation writes must roll back with the failed audit, not leave orphans.
  await db.query(`ALTER TABLE audit_logs ADD CONSTRAINT ${constraint} CHECK (actor_id <> '${auditActor.id}') NOT VALID`);
  constraintInstalled = true;
  await req("/api/patients", auditCookie, "POST", { ...patientInput, uhid: `${run}-rollback` }, 500);
  await req("/api/units", auditCookie, "POST", { name: `${run}-rollback` }, 500);
  await req("/api/machines", auditCookie, "POST", {
    unitId: unit.id, code: `${run}-rollback`, name: run, category: "Negative",
  }, 500);
  for (const [table, column] of [["patients", "uhid"], ["dialysis_units", "name"], ["dialysis_machines", "code"]]) {
    const result = await db.query(`SELECT count(*)::int count FROM ${table} WHERE ${column}=$1`, [`${run}-rollback`]);
    assert.equal(result.rows[0].count, 0, `${table} creation rolls back when audit logging fails`);
  }
  await db.query(`ALTER TABLE audit_logs DROP CONSTRAINT ${constraint}`); constraintInstalled = false;
  const audits = (await req("/api/audit-logs", admin)).auditLogs;
  for (const record of [patient, machine, unit]) {
    const entry = audits.find(a => a.entity_id === record.id && a.action.endsWith(".create"));
    assert.ok(entry?.metadata.after, "successful creations include their saved snapshot in the audit");
  }
  const demo = (await db.query("SELECT version,data FROM prescriptions WHERE id='DEMO-RX001'")).rows[0];
  if (demo?.version === 1) {
    const history = (await db.query("SELECT snapshot FROM prescription_versions WHERE prescription_id='DEMO-RX001' AND version=1")).rows;
    assert.deepEqual(history.map(h => h.snapshot), [demo.data], "demo v1 has exactly one initial saved snapshot");
  }
  await verifySchedulingLinksInBrowser({
    base, patient, other, racePatient, unit, machine, secondUnit, secondMachine, doctor, rx, date, request: req, admin,
  });
  console.log("staff backend gap tests passed (Called lifecycle, clinical-link API validation/options and FK, audit rollback, seed history, scheduling UI)");
} finally {
  if (constraintInstalled) await db.query(`ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS ${constraint}`);
  const sessionRows = ids.patients.length ? (await db.query("SELECT id FROM dialysis_sessions WHERE patient_id=ANY($1::text[])", [ids.patients])).rows.map(s => s.id) : [];
  const all = [...Object.values(ids).flat(), ...sessionRows];
  await db.query("DELETE FROM notifications WHERE user_id=ANY($1::text[]) OR patient_id=ANY($2::text[]) OR detail LIKE $3", [ids.users, ids.patients, `${run}%`]);
  await db.query("DELETE FROM audit_logs WHERE entity_id=ANY($1::text[]) OR actor_id=ANY($2::text[])", [all, ids.users]);
  await db.query("DELETE FROM dialysis_sessions WHERE id=ANY($1::text[])", [sessionRows]);
  await db.query("DELETE FROM prescription_versions WHERE prescription_id=ANY($1::text[])", [ids.prescriptions]);
  await db.query("DELETE FROM prescriptions WHERE id=ANY($1::text[])", [ids.prescriptions]);
  await db.query("DELETE FROM patients WHERE id=ANY($1::text[])", [ids.patients]);
  await db.query("DELETE FROM dialysis_machines WHERE id=ANY($1::text[])", [ids.machines]);
  await db.query("DELETE FROM dialysis_units WHERE id=ANY($1::text[])", [ids.units]);
  await db.query("DELETE FROM portal_users WHERE id=ANY($1::text[])", [ids.users]);
  await db.end();
}
