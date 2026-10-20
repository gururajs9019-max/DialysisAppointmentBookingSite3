import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { appointmentInterval, appointmentsOverlap, prescriptionSlot, MACHINE_RESERVED_MESSAGE } from "../shared/scheduling.mjs";
import { verifyAvailabilityBrowser } from "./scheduling-availability-ui.mjs";

const base = process.env.TEST_BASE_URL || "http://127.0.0.1:5000";
const db = new Pool({ connectionString: process.env.DATABASE_URL });
const prefix = `AVAIL-${randomUUID().slice(0, 8)}`;
const ids = { patients: [], machines: [], units: [], prescriptions: [], sessions: [] };
let cookie;
async function req(path, method = "GET", body, expected = 200) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (expected !== null) assert.equal(response.status, expected, `${method} ${path}: ${data.error || ""}`);
  if (data.session?.id && !ids.sessions.includes(data.session.id)) ids.sessions.push(data.session.id);
  return { ...data, statusCode: response.status, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
const day = offset => new Date(Date.now() + (10 + offset) * 86400000).toISOString().slice(0, 10);
try {
  for (const [raw, expected] of [
    ["8:00 AM – 12:00 PM", "Slot 1"], ["12:00 PM - 4:00 PM", "Slot 2"],
    ["16:00–20:00", "Slot 3"], ["Slot 1", "Slot 1"], ["9:00 AM – 1:00 PM", ""], ["", ""],
  ]) assert.equal(prescriptionSlot(raw).slot, expected);
  assert.equal(prescriptionSlot("9:00 AM – 1:00 PM").issue, "unsupported");
  assert.equal(prescriptionSlot(null).issue, "missing");
  const normal = { date: day(0), slot: "Slot 1" };
  assert.equal(appointmentsOverlap(normal, { ...normal, slot: "Slot 2" }), false);
  assert.equal(appointmentsOverlap(normal, { ...normal, slot: "Emergency", emergencyTime: "10:00", duration: "2 hours" }), true);
  assert.equal(appointmentInterval({ ...normal, slot: "Emergency", emergencyTime: "25:00" }), null);
  cookie = (await req("/api/auth/login", "POST", {
    role: "admin", identifier: "admin1", password: process.env.STAFF_ADMIN_PASSWORD,
  })).cookie;
  assert.ok(cookie);
  async function unit(suffix) {
    const result = (await req("/api/units", "POST", { name: `${prefix} ${suffix}` }, 201)).unit;
    ids.units.push(result.id); return result;
  }
  const firstUnit = await unit("unit"), otherUnit = await unit("other unit");
  async function machine(suffix, status = "available", category = "Negative", unitId = firstUnit.id) {
    const result = (await req("/api/machines", "POST", {
      unitId, code: `${prefix}-${suffix}`, name: `${prefix} ${suffix}`, status, category,
    }, 201)).machine;
    ids.machines.push(result.id); return result;
  }
  const main = await machine("main"), spare = await machine("spare");
  const maintenance = await machine("maintenance", "maintenance"), disabled = await machine("disabled", "disabled");
  const incompatible = await machine("hcv", "available", "HCV");
  const otherMachine = await machine("other", "available", "Negative", otherUnit.id);
  const patients = [];
  for (let i = 0; i < 5; i++) {
    const patient = (await req("/api/patients", "POST", {
      name: `${prefix} patient ${i}`, uhid: `${prefix}-${i}`, treatmentStatus: "Active",
      dialysisDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    }, 201)).patient;
    ids.patients.push(patient.id); patients.push(patient);
  }
  const rx = (await req("/api/prescriptions", "POST", {
    patientId: patients[0].id, diagnosis: `${prefix} prescription`, dialysisRx: { slot: "12:00 PM – 4:00 PM" },
  }, 201)).prescription;
  ids.prescriptions.push(rx.id);
  const beforeRx = (await db.query("SELECT data,version FROM prescriptions WHERE id=$1", [rx.id])).rows[0];
  const options = await req(`/api/scheduling-options?patientId=${patients[0].id}`);
  assert.equal(options.prescriptions.find(item => item.id === rx.id).prescribedSlot, "12:00 PM – 4:00 PM");
  assert.deepEqual((await req(`/api/scheduling-options?patientId=${patients[4].id}`)).prescriptions, []);
  const schedule = (patient, machine = main, offset = 0, slot = "Slot 1", extra = {}) => ({
    patientId: patient.id, machineId: machine.id, unitId: firstUnit.id, date: day(offset), slot, ...extra,
  });
  const first = (await req("/api/sessions", "POST", schedule(patients[0]), 201)).session;
  const conflict = await req("/api/sessions", "POST", schedule(patients[1]), 409);
  assert.equal(conflict.error, MACHINE_RESERVED_MESSAGE);
  const second = (await req("/api/sessions", "POST", schedule(patients[1], main, 0, "Slot 2"), 201)).session;
  const move = { status: first.status, machineId: main.id, unitId: firstUnit.id, date: day(0), slot: "Slot 1" };
  assert.equal((await req(`/api/sessions/${first.id}`, "PATCH", move)).session.id, first.id, "self does not block a reschedule");
  const original = (await db.query("SELECT * FROM dialysis_sessions WHERE id=$1", [first.id])).rows[0];
  await req(`/api/sessions/${first.id}`, "PATCH", { ...move, slot: "Slot 2" }, 409);
  assert.deepEqual((await db.query("SELECT * FROM dialysis_sessions WHERE id=$1", [first.id])).rows[0], original,
    "failed rescheduling preserves the original appointment, including its timestamp");
  await req(`/api/sessions/${second.id}`, "PATCH", { status: "cancelled" });
  await req(`/api/sessions/${first.id}`, "PATCH", { ...move, slot: "Slot 2" });
  await req("/api/sessions", "POST", schedule(patients[2]), 201);
  assert.deepEqual((await db.query("SELECT data,version FROM prescriptions WHERE id=$1", [rx.id])).rows[0], beforeRx,
    "appointment overrides never change prescription data or version");
  for (const machine of [maintenance, disabled, incompatible]) {
    await req("/api/sessions", "POST", schedule(patients[3], machine), 409);
    await req(`/api/sessions/${first.id}`, "PATCH", { ...move, machineId: machine.id }, 409);
  }
  await req("/api/sessions", "POST", { ...schedule(patients[3]), unitId: otherUnit.id }, 400);
  await req(`/api/sessions/${first.id}`, "PATCH", { ...move, unitId: otherUnit.id }, 400);
  for (const invalid of [
    { slot: "anything" }, { slot: "Emergency" }, { slot: "Emergency", emergencyTime: "25:00" },
    { slot: "Emergency", emergencyTime: "09:00", duration: "0 hours" },
    { slot: "Slot 1", slotType: "emergency", emergencyTime: "09:00" }, { date: "2026-02-30" },
  ]) await req("/api/sessions", "POST", { ...schedule(patients[3], spare), ...invalid }, 400);
  await req("/api/machines/" + main.id, "PATCH", { status: "in-use" });
  await req("/api/sessions", "POST", schedule(patients[3], main, 0, "Slot 3"), 201);
  await req("/api/sessions", "POST", schedule(patients[3], main, 1), 201);
  const race = await Promise.all(patients.slice(0, 2).map(patient =>
    req("/api/sessions", "POST", schedule(patient, spare, 2), null)));
  assert.deepEqual(race.map(result => result.statusCode).sort(), [201, 409], "concurrent normal reservations have exactly one winner");
  const overlapRace = await Promise.all([
    req("/api/sessions", "POST", schedule(patients[0], spare, 3), null),
    req("/api/sessions", "POST", schedule(patients[1], spare, 3, "Emergency", {
      slotType: "emergency", emergencyTime: "10:00", duration: "2 hours",
    }), null),
  ]);
  assert.deepEqual(overlapRace.map(result => result.statusCode).sort(), [201, 409],
    "machine locking prevents concurrent overlaps even when slot labels differ");
  await req("/api/sessions", "POST", schedule(patients[0], spare, 4, "Emergency", {
    slotType: "emergency", emergencyTime: "22:00", duration: "4 hours",
  }), 201);
  await req("/api/sessions", "POST", schedule(patients[1], spare, 5, "Emergency", {
    slotType: "emergency", emergencyTime: "01:00", duration: "1 hour",
  }), 409);
  await req("/api/sessions", "POST", schedule(patients[1], spare, 5, "Emergency", {
    slotType: "emergency", emergencyTime: "02:00", duration: "1 hour",
  }), 201);
  const cancelled = (await req("/api/sessions", "POST", schedule(patients[0], spare, 6), 201)).session;
  await req(`/api/sessions/${cancelled.id}`, "PATCH", { status: "cancelled" });
  await req("/api/sessions", "POST", schedule(patients[1], spare, 6), 201);
  await req(`/api/sessions/${cancelled.id}`, "PATCH", { status: "waiting" }, 409);
  const completed = (await req("/api/sessions", "POST", schedule(patients[0], spare, 7), 201)).session;
  await req(`/api/sessions/${completed.id}`, "PATCH", { status: "completed" });
  await req("/api/sessions", "POST", schedule(patients[1], spare, 7), 409);
  await req("/api/sessions", "POST", schedule(patients[1], spare, 8), 201);
  const unsupported = (await req("/api/prescriptions", "POST", {
    patientId: patients[3].id, diagnosis: `${prefix} unsupported prescription`, dialysisRx: { slot: "9:00 AM – 1:00 PM" },
  }, 201)).prescription;
  ids.prescriptions.push(unsupported.id);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  await req("/api/sessions", "POST", { ...schedule(patients[2], main, 0, "Slot 3"), date: today }, 201);
  await verifyAvailabilityBrowser({ base, patients, main, spare, maintenance, otherMachine, firstUnit, otherUnit });
  console.log("scheduling availability passed: prescription source, self exclusion, immutable failed reschedule, cancellation, maintenance/disabled/unit/viral rules, adjacent slots, completed dates, normal/emergency race protection and overnight overlaps");
} finally {
  const sessionIds = ids.patients.length
    ? (await db.query("SELECT id FROM dialysis_sessions WHERE patient_id=ANY($1::text[])", [ids.patients])).rows.map(row => row.id) : [];
  const all = [...Object.values(ids).flat(), ...sessionIds];
  await db.query("DELETE FROM notifications WHERE patient_id=ANY($1::text[]) OR record_id=ANY($2::text[]) OR message LIKE $3 OR detail LIKE $3",
    [ids.patients, all, `%${prefix}%`]);
  await db.query("DELETE FROM audit_logs WHERE entity_id=ANY($1::text[])", [all]);
  await db.query("DELETE FROM dialysis_sessions WHERE patient_id=ANY($1::text[])", [ids.patients]);
  await db.query("DELETE FROM prescription_versions WHERE prescription_id=ANY($1::text[])", [ids.prescriptions]);
  await db.query("DELETE FROM prescriptions WHERE id=ANY($1::text[])", [ids.prescriptions]);
  await db.query("DELETE FROM dialysis_machines WHERE id=ANY($1::text[])", [ids.machines]);
  await db.query("DELETE FROM patients WHERE id=ANY($1::text[])", [ids.patients]);
  await db.query("DELETE FROM dialysis_units WHERE id=ANY($1::text[])", [ids.units]);
  await db.end();
}
