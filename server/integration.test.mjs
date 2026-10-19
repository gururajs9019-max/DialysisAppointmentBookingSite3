/*
 * Requires a running local service plus STAFF_ADMIN_PASSWORD,
 * STAFF_DOCTOR_PASSWORD, DATABASE_URL, and SESSION_SECRET in its environment.
 * No secret values are logged.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { chromium } from "playwright";

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

async function runBrowserPatientHandoffTest(patient, machineCode, assignmentDate) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Administrator Portal" }).click();
    await page.getByLabel("Username").fill("admin1");
    await page.getByLabel("Password").fill(process.env.STAFF_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign In" }).click();

    await page.getByRole("heading", { name: "Today's Dialysis Patients" }).waitFor();
    await page.getByRole("button", { name: patient.name, exact: true }).click();
    await page.getByRole("heading", { name: "Select Dialysis Unit" }).waitFor();
    assert.equal(await page.getByText(patient.name, { exact: true }).isVisible(), true, "selected patient name must be shown at unit selection");
    assert.equal(await page.getByText(`(${patient.uhid})`, { exact: true }).isVisible(), true, "selected patient UHID must be shown at unit selection");

    await page.getByRole("button", { name: "Dashboard", exact: true }).click();
    await page.getByRole("button", { name: "Machines", exact: true }).click();
    await page.getByRole("heading", { name: "Machine Management" }).waitFor();
    const machineHeading = page.getByRole("heading", { name: machineCode, exact: true });
    const machineCard = machineHeading.locator("xpath=../../..");
    await machineCard.getByRole("button", { name: "Assign Patient", exact: true }).click();
    await page.getByRole("heading", { name: "Select Patient" }).waitFor();
    await page.getByRole("button").filter({ hasText: patient.name }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("heading", { name: "Select Dialysis Unit" }).waitFor();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("heading", { name: /Select Machine —/ }).waitFor();
    const selectedMachine = page.getByRole("button").filter({ hasText: machineCode });
    assert.equal(await selectedMachine.count(), 1, "machine action should preselect the chosen machine");
    assert.match(await selectedMachine.getAttribute("class") || "", /border-violet-500/, "prefilled machine should remain selected after choosing a patient");

    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("heading", { name: "Schedule & Confirm" }).waitFor();
    await page.getByRole("button", { name: /Normal Slot/ }).click();
    await page.getByRole("button", { name: /^Slot 1/ }).click();
    await page.locator('input[type="date"]').fill(assignmentDate);
    await page.getByRole("main").getByRole("button", { name: "Assign Patient", exact: true }).click();
    await page.getByRole("heading", { name: "Confirm Assignment" }).waitFor();
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await page.getByRole("heading", { name: "Assignment Confirmed" }).waitFor();
    await page.getByRole("button", { name: "Machines", exact: true }).click();
    await page.getByRole("heading", { name: "Machine Management" }).waitFor();
    const assignedMachineCard = page.getByRole("heading", { name: machineCode, exact: true }).locator("xpath=../../..");
    assert.equal(await assignedMachineCard.getByText("Reserved", { exact: true }).isVisible(), true, "assigned machine should show scheduled status without a refresh");
    assert.equal(await assignedMachineCard.getByText(patient.name, { exact: true }).isVisible(), true, "assigned machine should show its next patient without a refresh");
    assert.equal(await assignedMachineCard.getByRole("button", { name: "Assign Patient", exact: true }).count(), 0, "scheduled machine must not be offered as available");

    await page.getByRole("button", { name: "Dashboard", exact: true }).click();
    await page.route(`${baseUrl}/api/patients/${encodeURIComponent(patient.id)}`, route => route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "Patient was not found." }),
    }));
    await page.getByRole("button", { name: patient.name, exact: true }).click();
    await page.getByText(/Patient was not found\./).waitFor();
    assert.equal(await page.getByRole("heading", { name: "Select Patient" }).isVisible(), true, "missing patient must return to visible patient selection");
    assert.equal(await page.getByText(/Search for a patient below to choose one manually\./).isVisible(), true, "missing patient must show recovery guidance");
    assert.equal(await page.getByText(/Assigning for/).count(), 0, "missing patient must not select a fallback patient");
  } finally {
    await browser.close();
  }
}

async function runBrowserSessionOutcomeTest(patientName, machineCode, reason) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Administrator Portal" }).click();
    await page.getByLabel("Username").fill("admin1");
    await page.getByLabel("Password").fill(process.env.STAFF_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign In" }).click();
    await page.getByRole("heading", { name: "Today's Dialysis Patients" }).waitFor();

    await page.getByRole("button", { name: "Live Schedule", exact: true }).click();
    await page.getByRole("heading", { name: "Live Dialysis Schedule" }).waitFor();
    const sessionCard = page.getByRole("button").filter({ hasText: patientName });
    await sessionCard.waitFor();
    await sessionCard.click();
    await page.locator("#missed-session-reason").fill(reason);
    await page.getByRole("button", { name: "Mark as Missed", exact: true }).click();
    await sessionCard.getByText("Missed", { exact: true }).waitFor();

    await page.getByRole("button", { name: "Machines", exact: true }).click();
    await page.getByRole("heading", { name: "Machine Management" }).waitFor();
    const machineCard = page.getByRole("heading", { name: machineCode, exact: true }).locator("xpath=../../..");
    await machineCard.getByText("Available", { exact: true }).waitFor();
    assert.equal(await machineCard.getByText("Available", { exact: true }).isVisible(), true, "machine card should show released availability without a refresh");
  } finally {
    await browser.close();
  }
}

async function runBrowserSessionCancellationTest(machineName, machineCode) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Administrator Portal" }).click();
    await page.getByLabel("Username").fill("admin1");
    await page.getByLabel("Password").fill(process.env.STAFF_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign In" }).click();
    await page.getByRole("heading", { name: "Today's Dialysis Patients" }).waitFor();

    await page.getByRole("button", { name: "Live Schedule", exact: true }).click();
    await page.getByRole("heading", { name: "Live Dialysis Schedule" }).waitFor();
    const sessionCard = page.getByRole("button").filter({ hasText: machineName });
    await sessionCard.waitFor();
    assert.equal(await sessionCard.getByText("Scheduled", { exact: true }).isVisible(), true, "scheduled session should appear in Live Schedule");
    await sessionCard.click();
    await page.getByRole("button", { name: "Cancel Session", exact: true }).click();
    await sessionCard.getByText("Cancelled", { exact: true }).waitFor();

    await page.getByRole("button", { name: "Machines", exact: true }).click();
    await page.getByRole("heading", { name: "Machine Management" }).waitFor();
    const machineCard = page.getByRole("heading", { name: machineCode, exact: true }).locator("xpath=../../..");
    await machineCard.getByText("Available", { exact: true }).waitFor();
    assert.equal(await machineCard.getByText("Available", { exact: true }).isVisible(), true, "cancelled session should release its machine without a refresh");
    assert.equal(await machineCard.getByText("Assign Patient", { exact: true }).isVisible(), true, "released machine should immediately be available for assignment");
  } finally {
    await browser.close();
  }
}

try {
  await expectStatus(request("/api/patients"), 401, "unauthenticated patient read must be denied");
  const admin = await login("admin", process.env.STAFF_ADMIN_PASSWORD);
  const doctor = await login("doctor", process.env.STAFF_DOCTOR_PASSWORD);
  const today = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date());

  const primary = await expectStatus(request("/api/patients", {
    method: "POST", cookie: admin,
    body: {
      uhid: `${run}-NEG`, name: `${run} Negative Patient`, viralStatus: { hepatitisB: "Negative", hepatitisC: "Negative", hiv: "Negative" },
      dialysisDays: [today], dialysisDaysPerWeek: 1,
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
    return result.machine;
  };
  const negativeMachine = await createMachine("NEG-1", "Negative");
  const secondNegativeMachine = await createMachine("NEG-2", "Negative");
  const hcvMachine = await createMachine("HCV", "HCV");
  const browserAssignmentDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  await runBrowserPatientHandoffTest(primary.patient, negativeMachine.code, browserAssignmentDate);
  const browserSessions = await expectStatus(request("/api/sessions", { cookie: admin }), 200, "browser-created sessions should be readable");
  const browserSession = browserSessions.sessions.find(item =>
    item.patientId === primary.patient.id && item.machineId === negativeMachine.id && item.date === browserAssignmentDate && item.slot === "Slot 1"
  );
  assert.ok(browserSession, "browser assignment must persist a session");
  ids.sessions.push(browserSession.id);
  const outcomeMachine = await createMachine("OUTCOME", "Negative");
  const todayDate = new Date().toISOString().slice(0, 10);
  const outcomeSession = await expectStatus(request("/api/sessions", {
    method: "POST", cookie: admin,
    body: { patientId: primary.patient.id, machineId: outcomeMachine.id, unitId: "U1", date: todayDate, slot: "Slot 1" },
  }), 201, "staff should be able to schedule a session for the live schedule");
  ids.sessions.push(outcomeSession.session.id);
  const browserMissedReason = `${run} missed session reason`;
  await runBrowserSessionOutcomeTest(primary.patient.name, outcomeMachine.code, browserMissedReason);
  const browserOutcomeSessions = await expectStatus(request("/api/sessions", { cookie: admin }), 200, "browser-updated sessions should be readable");
  const persistedBrowserOutcome = browserOutcomeSessions.sessions.find(item => item.id === outcomeSession.session.id);
  assert.equal(persistedBrowserOutcome?.status, "missed", "schedule action should persist the missed outcome");
  assert.equal(persistedBrowserOutcome?.missedReason, browserMissedReason, "schedule action should persist the optional reason");
  const cancellationMachine = await createMachine("CANCEL", "Negative");
  const cancellationSession = await expectStatus(request("/api/sessions", {
    method: "POST", cookie: admin,
    body: { patientId: primary.patient.id, machineId: cancellationMachine.id, unitId: "U1", date: todayDate, slot: "Slot 3" },
  }), 201, "a session should be schedulable for the browser cancellation check");
  ids.sessions.push(cancellationSession.session.id);
  await runBrowserSessionCancellationTest(cancellationMachine.name, cancellationMachine.code);
  const browserCancelledSessions = await expectStatus(request("/api/sessions", { cookie: admin }), 200, "browser-cancelled sessions should be readable");
  assert.equal(
    browserCancelledSessions.sessions.find(item => item.id === cancellationSession.session.id)?.status,
    "cancelled",
    "Live Schedule cancellation should persist the cancelled status",
  );
  const machinesAfterBrowserCancellation = await expectStatus(request("/api/machines", { cookie: admin }), 200, "machine availability should reflect browser cancellation");
  const browserReleasedMachine = machinesAfterBrowserCancellation.machines.find(item => item.id === cancellationMachine.id);
  assert.equal(browserReleasedMachine?.status, "available", "browser cancellation should release the machine in persisted availability");
  assert.equal(browserReleasedMachine?.next_patient, null, "released machine should not retain the cancelled patient");
  const noReasonSession = await expectStatus(request("/api/sessions", {
    method: "POST", cookie: admin,
    body: { patientId: primary.patient.id, machineId: secondNegativeMachine.id, unitId: "U1", date: todayDate, slot: "Slot 2" },
  }), 201, "a session without a missed reason should be schedulable");
  ids.sessions.push(noReasonSession.session.id);
  const missedWithoutReason = await expectStatus(request(`/api/sessions/${noReasonSession.session.id}`, {
    method: "PATCH", cookie: doctor, body: { status: "missed" },
  }), 200, "staff should be able to record a missed session without a reason");
  assert.equal(missedWithoutReason.session.status, "missed", "missed outcome without a reason should be persisted");
  const date = new Date(Date.now() + 172_800_000).toISOString().slice(0, 10);
  const session = await expectStatus(request("/api/sessions", {
    method: "POST", cookie: doctor,
    body: { patientId: primary.patient.id, machineId: negativeMachine.id, unitId: "U1", date, slot: "Slot 1" },
  }), 201, "doctor should schedule a compatible session");
  ids.sessions.push(session.session.id);
  assert.equal(session.session.status, "scheduled", "new session POST DTO must retain scheduled status");
  const machinesAfterAssignment = await expectStatus(request("/api/machines", { cookie: doctor }), 200, "machines should be readable after an assignment");
  const scheduledMachine = machinesAfterAssignment.machines.find(item => item.id === negativeMachine.id);
  assert.equal(scheduledMachine?.status, "scheduled", "assigned machine must persist as scheduled");
  assert.equal(scheduledMachine?.next_patient, primary.patient.name, "assigned machine must expose its next patient");
  const scheduledSessions = await expectStatus(request("/api/sessions", { cookie: doctor }), 200, "sessions should be readable");
  assert.equal(scheduledSessions.sessions.find(item => item.id === session.session.id)?.status, "scheduled", "persisted session must not be represented as completed");
  await expectStatus(request("/api/sessions", {
    method: "POST", cookie: admin,
    body: { patientId: second.patient.id, machineId: negativeMachine.id, unitId: "U1", date, slot: "Slot 1" },
  }), 409, "machine double booking must conflict");
  await expectStatus(request("/api/sessions", {
    method: "POST", cookie: admin,
    body: { patientId: primary.patient.id, machineId: secondNegativeMachine.id, unitId: "U1", date, slot: "Slot 1" },
  }), 409, "patient double booking must conflict");
  await expectStatus(request("/api/sessions", {
    method: "POST", cookie: admin,
    body: { patientId: hcvPatient.patient.id, machineId: secondNegativeMachine.id, unitId: "U1", date, slot: "Slot 2" },
  }), 409, "viral-incompatible machine assignment must conflict");
  assert.ok(hcvMachine, "HCV machine creation is retained for cleanup coverage");
  const missedUpdate = await expectStatus(request(`/api/sessions/${session.session.id}`, {
    method: "PATCH", cookie: doctor,
    body: { status: "missed", missedReason: "Personal reason", missedReasonOther: `${run} transport disruption` },
  }), 200, "staff should record a missed session");
  assert.equal(missedUpdate.session.status, "missed", "outcome response should immediately include the missed session status");
  assert.equal(missedUpdate.machine.id, negativeMachine.id, "outcome response should include the affected machine");
  const missedSessions = await expectStatus(request("/api/sessions", { cookie: doctor }), 200, "updated sessions should be readable");
  const persistedMissed = missedSessions.sessions.find(item => item.id === session.session.id);
  assert.equal(persistedMissed?.status, "missed", "session status must persist as missed");
  assert.equal(persistedMissed?.missedReason, "Personal reason", "missed reason must survive the session DTO");
  assert.equal(persistedMissed?.missedReasonOther, `${run} transport disruption`, "other missed reason must survive the session DTO");
  const machineAfterMissed = await expectStatus(request("/api/machines", { cookie: doctor }), 200, "machine availability should refresh after a missed session");
  const stillScheduledMachine = machineAfterMissed.machines.find(item => item.id === negativeMachine.id);
  assert.equal(stillScheduledMachine?.status, "scheduled", "machine should remain scheduled while another active session remains");
  assert.equal(stillScheduledMachine?.next_patient, primary.patient.name, "machine should expose the next remaining active patient");
  const cancelledUpdate = await expectStatus(request(`/api/sessions/${browserSession.id}`, {
    method: "PATCH", cookie: doctor, body: { status: "cancelled" },
  }), 200, "staff should be able to cancel a scheduled session");
  assert.equal(cancelledUpdate.session.status, "cancelled", "cancellation response should immediately include the cancelled session status");
  assert.equal(cancelledUpdate.machine.id, negativeMachine.id, "cancellation response should include the affected machine");
  assert.equal(cancelledUpdate.machine.status, "available", "cancellation response should show the released machine");
  const machineAfterCancellation = await expectStatus(request("/api/machines", { cookie: doctor }), 200, "machine availability should refresh after a cancelled session");
  const releasedMachine = machineAfterCancellation.machines.find(item => item.id === negativeMachine.id);
  assert.equal(releasedMachine?.status, "available", "machine should be released after its last active session is cancelled");
  assert.equal(releasedMachine?.next_patient, null, "released machine should not expose a cancelled patient");

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
  try {
    const sessionIds = ids.patients.length
      ? (await db.query("SELECT id FROM dialysis_sessions WHERE patient_id = ANY($1::text[])", [ids.patients])).rows.map(row => row.id)
      : ids.sessions;
    const allIds = [...ids.patients, ...ids.machines, ...ids.sessions, ...sessionIds, ...ids.prescriptions];
    await db.query("DELETE FROM audit_logs WHERE entity_id = ANY($1::text[])", [allIds]);
    await db.query("DELETE FROM notifications WHERE detail LIKE $1", [`%${run}%`]);
    if (ids.prescriptions.length) await db.query("DELETE FROM prescription_versions WHERE prescription_id = ANY($1::text[])", [ids.prescriptions]);
    if (ids.prescriptions.length) await db.query("DELETE FROM prescriptions WHERE id = ANY($1::text[])", [ids.prescriptions]);
    if (sessionIds.length) await db.query("DELETE FROM dialysis_sessions WHERE id = ANY($1::text[])", [sessionIds]);
    if (ids.machines.length) await db.query("DELETE FROM dialysis_machines WHERE id = ANY($1::text[])", [ids.machines]);
    if (ids.patients.length) await db.query("DELETE FROM patients WHERE id = ANY($1::text[])", [ids.patients]);
  } finally {
    await db.end();
  }
}