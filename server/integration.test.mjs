/*
 * Requires a running local service plus STAFF_ADMIN_PASSWORD,
 * STAFF_DOCTOR_PASSWORD, DATABASE_URL, and SESSION_SECRET in its environment.
 * No secret values are logged.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:5000";
if (!process.env.STAFF_ADMIN_PASSWORD || !process.env.STAFF_DOCTOR_PASSWORD || !process.env.DATABASE_URL) {
  throw new Error("Integration test requires configured staff passwords and DATABASE_URL.");
}

const run = `INT-${randomUUID().slice(0, 12)}`;
const ids = { patients: [], machines: [], sessions: [], prescriptions: [] };
const db = new Pool({ connectionString: process.env.DATABASE_URL });

async function request(path, { method = "GET", body, cookie } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
async function login(role, password) {
  const result = await request("/api/auth/login", { method: "POST", body: { role, identifier: `${role}1`, password } });
  assert.equal(result.status, 200, `${role} login should succeed`);
  assert.ok(result.cookie, `${role} login should set a session`);
  return result.cookie;
}
async function expectStatus(promise, status, message) {
  const result = await promise;
  assert.equal(result.status, status, message);
  return result.payload;
}

try {
  await expectStatus(request("/api/patients"), 401, "unauthenticated patient read must be denied");
  const admin = await login("admin", process.env.STAFF_ADMIN_PASSWORD);
  const doctor = await login("doctor", process.env.STAFF_DOCTOR_PASSWORD);

  const primary = await expectStatus(request("/api/patients", {
    method: "POST", cookie: admin,
    body: {
      uhid: `${run}-NEG`, name: `${run} Negative Patient`, viralStatus: { hepatitisB: "Negative", hepatitisC: "Negative", hiv: "Negative" },
      medicalInfo: { dialysisAccess: "AV Fistula", opdIpd: "OPD" },
      investigations: { cbc: { hemoglobin: "10.4 g/dL" }, serumFerritin: "280 ng/mL" },
    },
  }), 201, "admin should create patients");
  ids.patients.push(primary.patient.id);
  const persistedPatient = await expectStatus(request(`/api/patients/${primary.patient.id}`, { cookie: doctor }), 200, "staff should read a patient detail by ID");
  assert.equal(persistedPatient.patient.medicalInfo.dialysisAccess, "AV Fistula", "patient medical information must persist into the detail record");
  assert.equal(persistedPatient.patient.investigations.serumFerritin, "280 ng/mL", "patient investigations must persist into the detail record");
  await expectStatus(request(`/api/patients/${randomUUID()}`, { cookie: doctor }), 404, "an unknown patient ID must be rejected without selecting another patient");
  await expectStatus(request("/api/patients", {
    method: "POST", cookie: doctor,
    body: { uhid: `${run}-DOCTOR`, name: "Denied", viralStatus: {} },
  }), 403, "doctor must not create patients");

  const second = await expectStatus(request("/api/patients", {
    method: "POST", cookie: admin,
    body: { uhid: `${run}-SECOND`, name: `${run} Second Patient`, viralStatus: {} },
  }), 201, "second patient should be created");
  ids.patients.push(second.patient.id);
  const hcvPatient = await expectStatus(request("/api/patients", {
    method: "POST", cookie: admin,
    body: { uhid: `${run}-HCV`, name: `${run} HCV Patient`, viralStatus: { hepatitisC: "Positive" } },
  }), 201, "HCV patient should be created");
  ids.patients.push(hcvPatient.patient.id);

  const createMachine = async (suffix, category) => {
    const result = await expectStatus(request("/api/machines", {
      method: "POST", cookie: admin,
      body: { unitId: "U1", code: `${run}-${suffix}`, name: `${run} ${suffix}`, category },
    }), 201, "admin should create test machine");
    ids.machines.push(result.machine.id);
    return result.machine.id;
  };
  const negativeMachine = await createMachine("NEG-1", "Negative");
  const secondNegativeMachine = await createMachine("NEG-2", "Negative");
  const hcvMachine = await createMachine("HCV", "HCV");
  const date = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const session = await expectStatus(request("/api/sessions", {
    method: "POST", cookie: doctor,
    body: { patientId: primary.patient.id, machineId: negativeMachine, unitId: "U1", date, slot: "Slot 1" },
  }), 201, "doctor should schedule a compatible session");
  ids.sessions.push(session.session.id);
  assert.equal(session.session.status, "scheduled", "new session POST DTO must retain scheduled status");
  const scheduledSessions = await expectStatus(request("/api/sessions", { cookie: doctor }), 200, "sessions should be readable");
  assert.equal(scheduledSessions.sessions.find(item => item.id === session.session.id)?.status, "scheduled", "persisted session must not be represented as completed");
  await expectStatus(request("/api/sessions", {
    method: "POST", cookie: admin,
    body: { patientId: second.patient.id, machineId: negativeMachine, unitId: "U1", date, slot: "Slot 1" },
  }), 409, "machine double booking must conflict");
  await expectStatus(request("/api/sessions", {
    method: "POST", cookie: admin,
    body: { patientId: primary.patient.id, machineId: secondNegativeMachine, unitId: "U1", date, slot: "Slot 1" },
  }), 409, "patient double booking must conflict");
  await expectStatus(request("/api/sessions", {
    method: "POST", cookie: admin,
    body: { patientId: hcvPatient.patient.id, machineId: secondNegativeMachine, unitId: "U1", date, slot: "Slot 2" },
  }), 409, "viral-incompatible machine assignment must conflict");
  assert.ok(hcvMachine, "HCV machine creation is retained for cleanup coverage");
  await expectStatus(request(`/api/sessions/${session.session.id}`, {
    method: "PATCH", cookie: doctor,
    body: { status: "missed", missedReason: "Personal reason", missedReasonOther: `${run} transport disruption` },
  }), 200, "staff should record a missed session");
  const missedSessions = await expectStatus(request("/api/sessions", { cookie: doctor }), 200, "updated sessions should be readable");
  const persistedMissed = missedSessions.sessions.find(item => item.id === session.session.id);
  assert.equal(persistedMissed?.status, "missed", "session status must persist as missed");
  assert.equal(persistedMissed?.missedReason, "Personal reason", "missed reason must survive the session DTO");
  assert.equal(persistedMissed?.missedReasonOther, `${run} transport disruption`, "other missed reason must survive the session DTO");

  const prescription = await expectStatus(request("/api/prescriptions", {
    method: "POST", cookie: doctor,
    body: { patientId: primary.patient.id, diagnosis: `${run} diagnosis`, dialysisRx: { duration: "4 Hours" }, medications: [], notes: "initial" },
  }), 201, "doctor should create a prescription");
  ids.prescriptions.push(prescription.prescription.id);
  const adminAfterDoctorCreation = await expectStatus(request("/api/notifications", { cookie: admin }), 200, "admin should receive doctor creation notifications");
  assert.ok(adminAfterDoctorCreation.notifications.some(n => n.message === "Prescription created" && n.detail.includes(`${run}-NEG`)), "doctor-created prescriptions must notify administrators");
  const doctorAfterOwnCreation = await expectStatus(request("/api/notifications", { cookie: doctor }), 200, "doctor notifications should remain role-scoped");
  assert.ok(!doctorAfterOwnCreation.notifications.some(n => n.message === "Prescription created" && n.detail.includes(`${run}-NEG`)), "the creating doctor must not receive their own creation notification");
  await expectStatus(request(`/api/prescriptions/${prescription.prescription.id}`, {
    method: "PATCH", cookie: doctor, body: { notes: `${run} doctor revision` },
  }), 200, "doctor should revise a prescription");
  const history = await expectStatus(request(`/api/prescriptions/${prescription.prescription.id}/history`, { cookie: admin }), 200, "prescription history should be readable");
  assert.equal(history.history.length, 2, "creation and revision must produce two immutable versions");
  assert.equal(history.history[0].changed_by_role, "doctor", "prescription history must identify the creation role");
  assert.equal(history.history[1].changed_by_role, "doctor", "prescription history must identify the editing role");
  const prescriptionsAfterDoctorEdit = await expectStatus(request("/api/prescriptions", { cookie: admin }), 200, "prescription details should be readable");
  const doctorEditedPrescription = prescriptionsAfterDoctorEdit.prescriptions.find(item => item.id === prescription.prescription.id);
  assert.equal(doctorEditedPrescription.createdByRole, "doctor", "prescription list must expose the authenticated creator role");
  assert.equal(doctorEditedPrescription.updatedByRole, "doctor", "prescription list must expose the latest editor role");
  const adminPrescription = await expectStatus(request("/api/prescriptions", {
    method: "POST", cookie: admin,
    body: { patientId: second.patient.id, diagnosis: `${run} administrator diagnosis`, dialysisRx: { duration: "4 Hours" }, medications: [], notes: "created by administrator" },
  }), 201, "admin should create a prescription");
  ids.prescriptions.push(adminPrescription.prescription.id);
  const doctorAfterAdminCreation = await expectStatus(request("/api/notifications", { cookie: doctor }), 200, "doctor should receive administrator creation notifications");
  assert.ok(doctorAfterAdminCreation.notifications.some(n => n.message === "Prescription created" && n.detail.includes(`${run}-SECOND`)), "administrator-created prescriptions must notify doctors");
  const adminAfterOwnCreation = await expectStatus(request("/api/notifications", { cookie: admin }), 200, "administrator notifications should remain role-scoped");
  assert.ok(!adminAfterOwnCreation.notifications.some(n => n.message === "Prescription created" && n.detail.includes(`${run}-SECOND`)), "the creating administrator must not receive their own creation notification");
  const refreshedAdminCreated = await expectStatus(request("/api/prescriptions", { cookie: doctor }), 200, "new prescription data should persist after refresh");
  assert.equal(refreshedAdminCreated.prescriptions.find(item => item.id === adminPrescription.prescription.id)?.createdByRole, "admin", "administrator creation metadata must persist across portals");
  const adminNotifications = await expectStatus(request("/api/notifications", { cookie: admin }), 200, "admin notifications should be readable");
  assert.ok(adminNotifications.notifications.some(n => n.detail.includes(`${run}-NEG`)), "doctor revision must notify admins");
  const doctorBeforeAdminRevision = await expectStatus(request("/api/notifications", { cookie: doctor }), 200, "doctor notifications should be readable");
  assert.ok(!doctorBeforeAdminRevision.notifications.some(n => n.message === "Prescription revised" && n.detail.includes(`${run}-NEG`)), "doctor must not see the admin-targeted revision notification");
  await expectStatus(request(`/api/prescriptions/${prescription.prescription.id}`, {
    method: "PATCH", cookie: admin, body: { notes: `${run} admin revision` },
  }), 200, "admin should revise a prescription");
  const prescriptionsAfterAdminEdit = await expectStatus(request("/api/prescriptions", { cookie: doctor }), 200, "revised prescription metadata should be synchronized across roles");
  const adminEditedPrescription = prescriptionsAfterAdminEdit.prescriptions.find(item => item.id === prescription.prescription.id);
  assert.equal(adminEditedPrescription.createdByRole, "doctor", "creator metadata must remain immutable after later edits");
  assert.equal(adminEditedPrescription.updatedByRole, "admin", "latest editor metadata must come from the authenticated backend actor");
  const doctorNotifications = await expectStatus(request("/api/notifications", { cookie: doctor }), 200, "doctor notifications should be readable");
  assert.ok(doctorNotifications.notifications.some(n => n.detail.includes(`${run}-NEG`)), "admin revision must notify doctors");
  const analytics = await expectStatus(request("/api/analytics", { cookie: admin }), 200, "analytics should be readable by admin");
  assert.equal(typeof analytics.analytics, "object");
  console.log("backend integration tests passed");
} finally {
  const allIds = [...ids.patients, ...ids.machines, ...ids.sessions, ...ids.prescriptions];
  try {
    await db.query("DELETE FROM audit_logs WHERE entity_id = ANY($1::text[])", [allIds]);
    await db.query("DELETE FROM notifications WHERE detail LIKE $1", [`%${run}%`]);
    if (ids.prescriptions.length) await db.query("DELETE FROM prescription_versions WHERE prescription_id = ANY($1::text[])", [ids.prescriptions]);
    if (ids.prescriptions.length) await db.query("DELETE FROM prescriptions WHERE id = ANY($1::text[])", [ids.prescriptions]);
    if (ids.sessions.length) await db.query("DELETE FROM dialysis_sessions WHERE id = ANY($1::text[])", [ids.sessions]);
    if (ids.machines.length) await db.query("DELETE FROM dialysis_machines WHERE id = ANY($1::text[])", [ids.machines]);
    if (ids.patients.length) await db.query("DELETE FROM patients WHERE id = ANY($1::text[])", [ids.patients]);
  } finally {
    await db.end();
  }
}