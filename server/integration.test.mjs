/*
 * Requires a running local service plus STAFF_ADMIN_PASSWORD,
 * STAFF_DOCTOR_PASSWORD, DATABASE_URL, and SESSION_SECRET in its environment.
 * No secret values are logged.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { chromium } from "playwright";
import { transformWithEsbuild } from "vite";

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

async function runBrowserPrescriptionCacheTest(prescriptionId, adminCookie, doctorCookie) {
  // Load the real client in isolated browser modules. The same integration suite
  // also runs against the production server, which must not serve TS source URLs.
  const source = await readFile(new URL("../src/app/lib/staffApi.ts", import.meta.url), "utf8");
  const { code } = await transformWithEsbuild(source, "staffApi.ts", { loader: "ts" });
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
  const browser = await chromium.launch({ headless: true });
  try {
    const pages = {};
    const counts = { admin: [], doctor: [] };
    for (const [role, cookie] of [["admin", adminCookie], ["doctor", doctorCookie]]) {
      const context = await browser.newContext();
      const separator = cookie.indexOf("=");
      await context.addCookies([{ name: cookie.slice(0, separator), value: cookie.slice(separator + 1), url: baseUrl }]);
      const page = pages[role] = await context.newPage();
      page.on("request", req => {
        if (new URL(req.url()).pathname === "/api/prescription-histories") counts[role].push(req.postDataJSON().prescriptions.length);
      });
      await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
      await page.evaluate(async url => { globalThis.staffApiTest = await import(url); }, moduleUrl);
      const coldCount = await page.evaluate(async () => {
        return (await globalThis.staffApiTest.loadStaffData()).prescriptions.length;
      });
      assert.equal(counts[role].length, Math.ceil(coldCount / 500), `${role} cold load uses bounded history batches`);
      assert.equal(counts[role].reduce((total, count) => total + count, 0), coldCount, "cold batch covers every prescription exactly once");
      counts[role] = [];
      await page.evaluate(async () => {
        await globalThis.staffApiTest.loadStaffData();
      });
      assert.equal(counts[role].length, 0, `${role} unchanged refresh must reuse history`);
    }

    const read = page => page.evaluate(async id => {
      const api = globalThis.staffApiTest;
      return (await api.fetchPrescriptions()).find(row => row.id === id);
    }, prescriptionId);
    const initial = await read(pages.admin);
    for (const [role, peer] of [["doctor", "admin"], ["admin", "doctor"]]) {
      counts.admin = []; counts.doctor = [];
      const notes = `${run} ${role} cached revision`;
      const saved = await pages[role].evaluate(async ({ id, notes }) => {
        const api = globalThis.staffApiTest;
        const draft = (await api.fetchPrescriptions()).find(row => row.id === id);
        return api.updatePrescription(id, { ...draft, notes, updatedBy: "Untrusted name", updatedByRole: "Untrusted role" });
      }, { id: prescriptionId, notes });
      assert.deepEqual(counts[role], [1], `${role} save reloads only the revised history`);
      assert.equal(saved.updatedByRole, role, "save author must remain server-authenticated");
      assert.notEqual(saved.updatedBy, "Untrusted name");
      const refreshed = await read(pages[peer]);
      assert.deepEqual(counts[peer], [1], `${peer} detects the other portal's revision from the list version`);
      assert.equal(refreshed.version, saved.version);
      assert.equal(refreshed.notes, notes);
      assert.deepEqual(refreshed.history, saved.history, "both portals must see identical immutable history");
      assert.deepEqual(refreshed.history.slice(-initial.history.length), initial.history, "earlier snapshots remain unchanged");
      assert.equal(refreshed.history[0].notes, role === "doctor" ? initial.notes : `${run} doctor cached revision`);
      assert.notEqual(refreshed.notes, refreshed.history[0].notes, "comparison views must receive distinct current and previous snapshots");
      counts[peer] = [];
      await read(pages[peer]);
      assert.equal(counts[peer].length, 0, "next unchanged refresh reuses the revised history");
    }
  } finally {
    await browser.close();
  }
}

async function runBrowserPatientHandoffTest(patient, machine, alternateMachine, conflictPatientId, assignmentDate) {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ timezoneId: "Asia/Kolkata" });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Administrator Portal" }).click();
    await page.getByLabel("Username").fill("admin1");
    await page.getByLabel("Password").fill(process.env.STAFF_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign In" }).click();

    await page.getByRole("heading", { name: "Today's Dialysis Patients" }).waitFor();
    const dashboardPatientRow = () => page.locator("div.divide-y.divide-slate-50 > div.px-6.py-4")
      .filter({ hasText: patient.uhid });
    const unassignedPatientRow = dashboardPatientRow();
    assert.equal(await unassignedPatientRow.getByRole("button", { name: patient.name, exact: true }).count(), 0,
      "clicking a patient name must not open the appointment actions");
    await unassignedPatientRow.getByText(patient.name, { exact: true }).click();
    assert.equal(await page.getByRole("dialog").count(), 0, "patient name must remain non-interactive");
    assert.equal(await unassignedPatientRow.getByRole("button", { name: `Appointment actions for ${patient.name}` }).count(), 0,
      "the Today’s Dialysis list must not expose an appointment menu");
    await unassignedPatientRow.getByRole("button", { name: "Assign", exact: true }).click();
    await page.getByRole("heading", { name: "Select Dialysis Unit" }).waitFor();
    assert.equal(await page.getByText(patient.name, { exact: true }).isVisible(), true, "selected patient name must be shown at unit selection");
    const unitOne = page.getByRole("button").filter({ hasText: "Unit 1" }).last();
    await unitOne.click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("heading", { name: /Select Machine —/ }).waitFor();
    const initialMachine = page.getByRole("button").filter({ hasText: machine.code });
    assert.equal(await initialMachine.count(), 1, "the schedule should display actual database machines");
    await initialMachine.click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("heading", { name: "Schedule & Confirm" }).waitFor();
    await page.getByRole("button", { name: /Normal Slot/ }).click();
    await page.getByRole("button", { name: /^Slot 1/ }).click();
    const appointmentDateField = page.getByLabel("Appointment date");
    assert.equal(await appointmentDateField.inputValue(), assignmentDate, "Today assignment must default to the browser's local date");
    assert.equal(await appointmentDateField.getAttribute("readonly"), "", "Today assignment date must be read-only");
    assert.equal(await page.getByLabel("Treating Doctor").count(), 0, "Today assignment must not require or display a treating doctor selector");
    const unitsRefreshed = page.waitForResponse(response => new URL(response.url()).pathname === "/api/units");
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await unitsRefreshed;
    await page.waitForLoadState("networkidle");
    assert.equal(await page.getByRole("heading", { name: "Schedule & Confirm" }).isVisible(),true,
      "a background staff refresh must not restart an in-progress assignment");
    assert.equal(await appointmentDateField.inputValue(),assignmentDate,
      "the assignment date survives background refresh");
    await page.getByRole("main").getByRole("button", { name: "Assign Patient", exact: true }).click();
    await page.getByRole("heading", { name: "Confirm Assignment" }).waitFor();
    let failFirstAssignment = true;
    await page.route("**/api/sessions", async route => {
      if (route.request().method() === "POST" && failFirstAssignment) {
        failFirstAssignment = false;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Synthetic network failure. Retry the assignment." }),
        });
        return;
      }
      await route.continue();
    });
    const failedAssignmentResponse = page.waitForResponse(response =>
      new URL(response.url()).pathname === "/api/sessions" && response.request().method() === "POST");
    page.on("dialog", dialog => dialog.dismiss());
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    const failedAssignment = await failedAssignmentResponse;
    assert.equal(failedAssignment.status(), 503, "a simulated network failure must be surfaced");
    await page.getByRole("alert").getByText(/Synthetic network failure/).waitFor();
    assert.equal(await page.getByRole("heading", { name: "Confirm Assignment" }).isVisible(), true,
      "a failed request must keep the assignment draft available for retry");
    assert.equal(await page.getByRole("heading", { name: "Assignment Confirmed" }).count(), 0,
      "a failed request must not report a saved assignment");
    assert.equal(await page.getByRole("button", { name: "Confirm", exact: true }).isEnabled(), true,
      "the administrator can retry after a failure");
    const assignmentResponse = page.waitForResponse(response =>
      new URL(response.url()).pathname === "/api/sessions" && response.request().method() === "POST");
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    const savedAssignment = await assignmentResponse;
    const assignmentResult = await savedAssignment.json();
    assert.equal(savedAssignment.status(),201,assignmentResult.error || "browser assignment must save successfully");
    const assignedSessionId = assignmentResult.session.id;
    await page.getByRole("heading", { name: "Assignment Confirmed" }).waitFor();

    const conflictResponses = await page.evaluate(async ({ patientId, conflictPatientId, machineId, date }) => {
      const payloads = [
        { patientId, machineId, unitId: "U1", date, slot: "Slot 1" },
        { patientId: conflictPatientId, machineId, unitId: "U1", date, slot: "Slot 1" },
      ];
      const results = await Promise.all(payloads.map(async payload => {
        const response = await fetch("/api/sessions", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        return response.status;
      }));
      return results;
    }, { patientId: patient.id, conflictPatientId, machineId: machine.id, date: assignmentDate });
    assert.deepEqual(conflictResponses, [409, 409], "patient and machine duplicate-slot conflicts must be rejected");
    await page.getByRole("button", { name: "Machines", exact: true }).click();
    await page.getByRole("heading", { name: "Machine Management" }).waitFor();
    const assignedMachineCard = page.getByRole("heading", { name: machine.code, exact: true }).locator("xpath=../../..");
    assert.equal(await assignedMachineCard.getByText("Reserved", { exact: true }).isVisible(), true, "assigned machine should show scheduled status without a refresh");
    assert.equal(await assignedMachineCard.getByText(patient.name, { exact: true }).isVisible(), true, "assigned machine should show its next patient without a refresh");
    assert.equal(await assignedMachineCard.getByRole("button", { name: "Assign Patient", exact: true }).count(), 0, "scheduled machine must not be offered as available");

    await page.getByRole("button", { name: "Dashboard", exact: true }).click();
    await page.locator('input[type="date"]').fill(assignmentDate);
    const dailyPatientRow = dashboardPatientRow();
    await dailyPatientRow.getByText("Waiting", { exact: true }).waitFor();
    await dailyPatientRow.getByText("Assigned", { exact: true }).waitFor();
    await dailyPatientRow.getByText(machine.name, { exact: true }).waitFor();
    assert.equal(await dailyPatientRow.getByRole("button", { name: "Assign", exact: true }).count(), 0,
      "the daily patient list must reflect the saved YYYY-MM-DD session and hide Assign");

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Administrator Portal" }).click();
    await page.getByLabel("Username").fill("admin1");
    await page.getByLabel("Password").fill(process.env.STAFF_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign In" }).click();
    await page.getByRole("heading", { name: "Today's Dialysis Patients" }).waitFor();
    await page.locator('input[type="date"]').fill(assignmentDate);
    const refreshedDailyPatientRow = dashboardPatientRow();
    await refreshedDailyPatientRow.getByText("Waiting", { exact: true }).waitFor();
    await refreshedDailyPatientRow.getByText("Assigned", { exact: true }).waitFor();
    assert.equal(await refreshedDailyPatientRow.getByRole("button", { name: "Assign", exact: true }).count(), 0,
      "the assignment remains visible and cannot be assigned again after a full page reload");

    const nextDateValue = new Date(`${assignmentDate}T12:00:00`);
    nextDateValue.setDate(nextDateValue.getDate() + 1);
    const rescheduledDate = `${nextDateValue.getFullYear()}-${String(nextDateValue.getMonth() + 1).padStart(2, "0")}-${String(nextDateValue.getDate()).padStart(2, "0")}`;
    await page.getByRole("button", { name: "Live Schedule", exact: true }).click();
    await page.getByLabel("Schedule date").fill(assignmentDate);
    const liveScheduleCard = () => page.getByRole("button").filter({ hasText: patient.uhid }).filter({ hasText: machine.name }).first();
    await liveScheduleCard().waitFor();
    await liveScheduleCard().click();
    assert.equal(await page.getByRole("button", { name: "Call Patient", exact: true }).count(), 0,
      "the manual status workflow must not show a Call Patient action");
    assert.equal(await page.getByRole("button", { name: "Start Treatment", exact: true }).isVisible(), true,
      "staff can explicitly start a scheduled session");
    await page.getByRole("button", { name: "Reschedule Slot", exact: true }).click();
    const assignedDetails = page.getByRole("dialog");
    await assignedDetails.getByRole("heading", { name: "Reschedule Slot" }).waitFor();
    assert.equal(await page.getByLabel("Reschedule machine").inputValue(), machine.id,
      "rescheduling must load the patient's currently assigned machine");
    assert.equal(await page.getByLabel("Reschedule date").getAttribute("type"), "date",
      "staff can change the appointment date from Live Schedule");
    await page.getByLabel("Reschedule date").fill(rescheduledDate);
    await page.getByLabel("Reschedule unit").selectOption({ label: "Unit 2" });
    await page.getByLabel("Reschedule machine").selectOption({ label: `${alternateMachine.code} · Negative` });
    await page.getByLabel("Reschedule time slot").selectOption("Slot 2");
    let failFirstReschedule = true;
    await page.route(`**/api/sessions/${assignedSessionId}`, async route => {
      if (route.request().method() === "PATCH" && failFirstReschedule) {
        failFirstReschedule = false;
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ error: "Synthetic appointment conflict. Try another slot." }),
        });
        return;
      }
      await route.continue();
    });
    const failedRescheduleResponsePromise = page.waitForResponse(response =>
      new URL(response.url()).pathname === `/api/sessions/${assignedSessionId}` && response.request().method() === "PATCH");
    await page.getByRole("button", { name: "Save Reschedule", exact: true }).click();
    const failedRescheduleResponse = await failedRescheduleResponsePromise;
    assert.equal(failedRescheduleResponse.status(), 409, "reschedule slot conflicts must be surfaced without discarding the draft");
    await page.getByRole("alert").getByText(/Synthetic appointment conflict/).waitFor();
    assert.equal(await page.getByRole("heading", { name: "Reschedule Slot" }).isVisible(), true,
      "a failed reschedule must leave the editing form open");
    assert.equal(await page.getByLabel("Reschedule machine").inputValue(), alternateMachine.id,
      "a failed reschedule must preserve the selected machine");
    assert.equal(await page.getByLabel("Reschedule time slot").inputValue(), "Slot 2",
      "a failed reschedule must preserve the selected slot");
    assert.equal(await page.getByRole("button", { name: "Save Reschedule", exact: true }).isEnabled(), true,
      "the administrator can retry after a reschedule conflict");
    const rescheduleResponsePromise = page.waitForResponse(response =>
      new URL(response.url()).pathname === `/api/sessions/${assignedSessionId}` && response.request().method() === "PATCH");
    await page.getByRole("button", { name: "Save Reschedule", exact: true }).click();
    const rescheduleResponse = await rescheduleResponsePromise;
    const rescheduleResult = await rescheduleResponse.json();
    assert.equal(rescheduleResponse.status(), 200, rescheduleResult.error || "Live Schedule rescheduling must save successfully");
    assert.equal(rescheduleResult.session.id, assignedSessionId, "rescheduling must update the original session row");
    assert.equal(rescheduleResult.session.machineId, alternateMachine.id, "rescheduled session must use the chosen machine");
    assert.equal(rescheduleResult.session.date, rescheduledDate, "rescheduling must save the newly selected local date");
    assert.equal(rescheduleResult.session.slot, "Slot 2", "rescheduled appointment must use the chosen time slot");
    await page.unroute(`**/api/sessions/${assignedSessionId}`);
    await assignedDetails.getByRole("heading", { name: "Appointment Details" }).waitFor();
    await assignedDetails.getByText(alternateMachine.name, { exact: true }).waitFor();
    await assignedDetails.getByText("Slot 2 · 12:00 PM – 4:00 PM", { exact: true }).waitFor();

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Administrator Portal" }).click();
    await page.getByLabel("Username").fill("admin1");
    await page.getByLabel("Password").fill(process.env.STAFF_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign In" }).click();
    await page.getByRole("heading", { name: "Today's Dialysis Patients" }).waitFor();
    await page.getByRole("button", { name: "Live Schedule", exact: true }).click();
    await page.getByLabel("Schedule date").fill(rescheduledDate);
    const persistedRescheduleCard = () => page.getByRole("button").filter({ hasText: patient.uhid }).filter({ hasText: alternateMachine.name }).first();
    await persistedRescheduleCard().waitFor();
    await persistedRescheduleCard().click();
    await page.getByRole("button", { name: "Cancel Slot", exact: true }).click();
    await page.getByRole("heading", { name: "Cancel Slot", exact: true }).waitFor();
    const cancellationSlotDetails = page.getByRole("dialog").locator("p").filter({ hasText: "Slot:" });
    await cancellationSlotDetails.waitFor({ state: "visible" });
    assert.match((await cancellationSlotDetails.innerText()).replace(/\s+/g, " "), /Slot 2.*12:00 PM.*4:00 PM/);
    let appointmentPatchCount = 0;
    const countAppointmentPatch = request => {
      if (request.method() === "PATCH" && new URL(request.url()).pathname === `/api/sessions/${assignedSessionId}`) {
        appointmentPatchCount += 1;
      }
    };
    page.on("request", countAppointmentPatch);
    await page.getByRole("button", { name: "Keep Slot", exact: true }).click();
    assert.equal(await page.getByRole("dialog").count(), 0, "Keep Slot closes confirmation without changing the appointment");
    assert.equal(appointmentPatchCount, 0, "Keep Slot must not send a cancellation update");
    await page.getByRole("button", { name: "Cancel Slot", exact: true }).click();
    await page.getByRole("heading", { name: "Cancel Slot", exact: true }).waitFor();
    const cancellationResponsePromise = page.waitForResponse(response =>
      new URL(response.url()).pathname === `/api/sessions/${assignedSessionId}` && response.request().method() === "PATCH");
    await page.getByRole("button", { name: "Confirm Cancellation", exact: true }).click();
    const cancellationResponse = await cancellationResponsePromise;
    const cancellationResult = await cancellationResponse.json();
    assert.equal(cancellationResponse.status(), 200, cancellationResult.error || "dashboard cancellation must save successfully");
    assert.equal(appointmentPatchCount, 1, "confirming cancellation sends exactly one update");
    page.off("request", countAppointmentPatch);
    assert.equal(cancellationResult.session.id, assignedSessionId, "cancellation must retain the appointment record");
    assert.equal(cancellationResult.session.status, "cancelled", "cancellation must be persisted");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Administrator Portal" }).click();
    await page.getByLabel("Username").fill("admin1");
    await page.getByLabel("Password").fill(process.env.STAFF_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign In" }).click();
    await page.getByRole("heading", { name: "Today's Dialysis Patients" }).waitFor();
    await page.locator('input[type="date"]').fill(assignmentDate);
    const cancelledDailyPatientRow = dashboardPatientRow();
    await cancelledDailyPatientRow.getByText("Unassigned", { exact: true }).waitFor();
    assert.equal(await cancelledDailyPatientRow.getByRole("button", { name: "Assign", exact: true }).isVisible(), true,
      "cancelling an appointment must immediately release the patient for a new assignment");

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Administrator Portal" }).click();
    await page.getByLabel("Username").fill("admin1");
    await page.getByLabel("Password").fill(process.env.STAFF_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign In" }).click();
    await page.getByRole("heading", { name: "Today's Dialysis Patients" }).waitFor();
    const persistedCancellationRow = dashboardPatientRow();
    await persistedCancellationRow.getByText("Unassigned", { exact: true }).waitFor();

    await page.route(`${baseUrl}/api/patients/${encodeURIComponent(patient.id)}`, route => route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "Patient was not found." }),
    }));
    await dashboardPatientRow().getByRole("button", { name: "Assign", exact: true }).click();
    await page.getByText(/Patient was not found\./).waitFor();
    assert.equal(await page.getByRole("heading", { name: "Select Patient" }).isVisible(), true, "missing patient must return to visible patient selection");
    assert.equal(await page.getByText(/Search for a patient below to choose one manually\./).isVisible(), true, "missing patient must show recovery guidance");
    assert.equal(await page.getByText(/Assigning for/).count(), 0, "missing patient must not select a fallback patient");
  } finally {
    await browser.close();
  }
}

async function runBrowserSessionOutcomeTest(patientName, machineCode, machineName, reason) {
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
    const sessionCard = page.getByRole("button").filter({ hasText: patientName }).filter({ hasText: machineName });
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

    await page.getByRole("button", { name: "Live Schedule", exact: true }).click();
    await page.getByRole("heading", { name: "Live Dialysis Schedule" }).waitFor();
    const revisitedSession = page.getByRole("button").filter({ hasText: patientName }).filter({ hasText: machineName });
    await revisitedSession.waitFor();
    await revisitedSession.click();
    await page.getByRole("heading", { name: "Missed Session Reason" }).waitFor();
    assert.equal(await page.getByText(reason, { exact: true }).isVisible(), true, "saved missed reason should remain visible after leaving and reopening the session");

    await page.getByRole("navigation").getByRole("button", { name: /^Missed Slots/ }).click();
    await page.getByRole("heading", { name: "Missed Slot Management" }).waitFor();
    assert.equal(await page.getByText(reason, { exact: true }).isVisible(), true, "Missed Slots should show the same saved reason");

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Administrator Portal" }).click();
    await page.getByLabel("Username").fill("admin1");
    await page.getByLabel("Password").fill(process.env.STAFF_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign In" }).click();
    await page.getByRole("heading", { name: "Today's Dialysis Patients" }).waitFor();
    await page.getByRole("button", { name: "Live Schedule", exact: true }).click();
    await revisitedSession.click();
    await page.getByRole("heading", { name: "Missed Session Reason" }).waitFor();
    assert.equal(await page.getByText(reason, { exact: true }).isVisible(), true, "missed reason should reload from saved session data after a full page refresh");
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
    await page.getByRole("button", { name: "Cancel Slot", exact: true }).click();
    await page.getByRole("heading", { name: "Cancel Slot", exact: true }).waitFor();
    await page.getByRole("button", { name: "Confirm Cancellation", exact: true }).click();
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
  const localDateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date()).reduce((parts, part) => ({ ...parts, [part.type]: part.value }), {});
  const browserAssignmentDate = `${localDateParts.year}-${localDateParts.month}-${localDateParts.day}`;
  const today = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "long" }).format(new Date());

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
  const rescheduleMachine = await expectStatus(request("/api/machines", {
    method: "POST", cookie: admin,
    body: { unitId: "U2", code: `${run}-RESCHEDULE`, name: `${run} Reschedule`, category: "Negative" },
  }), 201, "admin should create a second-unit reschedule machine");
  ids.machines.push(rescheduleMachine.machine.id);
  await runBrowserPatientHandoffTest(primary.patient, negativeMachine, rescheduleMachine.machine, second.patient.id, browserAssignmentDate);
  const browserSessions = await expectStatus(request("/api/sessions", { cookie: admin }), 200, "browser-created sessions should be readable");
  const expectedBrowserRescheduleDate = new Date(`${browserAssignmentDate}T12:00:00`);
  expectedBrowserRescheduleDate.setDate(expectedBrowserRescheduleDate.getDate() + 1);
  const expectedBrowserRescheduleDateKey = `${expectedBrowserRescheduleDate.getFullYear()}-${String(expectedBrowserRescheduleDate.getMonth() + 1).padStart(2, "0")}-${String(expectedBrowserRescheduleDate.getDate()).padStart(2, "0")}`;
  const browserSession = browserSessions.sessions.find(item =>
    item.patientId === primary.patient.id && item.machineId === rescheduleMachine.machine.id &&
    item.slot === "Slot 2"
  );
  assert.ok(browserSession, "Live Schedule rescheduling must preserve the browser-created session");
  assert.equal(browserSession.date, expectedBrowserRescheduleDateKey, "the rescheduled appointment must remain persisted on its new date");
  assert.equal(browserSession.status, "cancelled", "the Live Schedule cancellation must retain the session row");
  ids.sessions.push(browserSession.id);
  const machinesAfterLiveScheduleCancellation = await expectStatus(request("/api/machines", { cookie: admin }), 200, "Live Schedule cancellation should release its destination machine");
  assert.equal(machinesAfterLiveScheduleCancellation.machines.find(item => item.id === rescheduleMachine.machine.id)?.status,
    "available", "cancelling a rescheduled appointment should release the destination machine");
  const outcomeMachine = await createMachine("OUTCOME", "Negative");
  const todayDate = new Date().toISOString().slice(0, 10);
  const outcomeSession = await expectStatus(request("/api/sessions", {
    method: "POST", cookie: admin,
    body: { patientId: primary.patient.id, machineId: outcomeMachine.id, unitId: "U1", date: todayDate, slot: "Slot 1" },
  }), 201, "staff should be able to schedule a session for the live schedule");
  ids.sessions.push(outcomeSession.session.id);
  const browserMissedReason = `${run} missed session reason`;
  await runBrowserSessionOutcomeTest(primary.patient.name, outcomeMachine.code, outcomeMachine.name, browserMissedReason);
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
  const remainingMachineSession = await expectStatus(request("/api/sessions", {
    method: "POST", cookie: doctor,
    body: { patientId: second.patient.id, machineId: negativeMachine.id, unitId: "U1", date, slot: "Slot 2" },
  }), 201, "machine should support a second non-conflicting scheduled appointment");
  ids.sessions.push(remainingMachineSession.session.id);
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
  assert.equal(stillScheduledMachine?.next_patient, second.patient.name, "machine should expose the next remaining active patient");
  const cancelledUpdate = await expectStatus(request(`/api/sessions/${remainingMachineSession.session.id}`, {
    method: "PATCH", cookie: doctor, body: { status: "cancelled" },
  }), 200, "staff should be able to cancel a remaining scheduled session");
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
    method: "PATCH", cookie: doctor, body: { baseVersion: 1, notes: `${run} doctor revision` },
  }), 200, "doctor should revise a prescription");
  const history = await expectStatus(request(`/api/prescriptions/${prescription.prescription.id}/history`, { cookie: admin }), 200, "prescription history should be readable");
  assert.equal(history.history.length, 2, "creation and revision must produce two immutable versions");
  assert.equal(history.history[0].changed_by_role, "doctor", "prescription history must identify the creation role");
  assert.equal(history.history[1].changed_by_role, "doctor", "prescription history must identify the editing role");
  const batchBody = { prescriptions: [{ id: prescription.prescription.id, version: 2 }] };
  await expectStatus(request("/api/prescription-histories", { method: "POST", body: batchBody }), 401, "batch histories require staff authentication");
  await expectStatus(request("/api/prescription-histories", {
    method: "POST", cookie: admin, body: { prescriptions: [{ id: prescription.prescription.id, version: "2" }] },
  }), 400, "batch histories reject invalid versions");
  const batch = await expectStatus(request("/api/prescription-histories", {
    method: "POST", cookie: admin, body: batchBody,
  }), 200, "batch histories should be readable");
  assert.deepEqual(batch.histories[0].history.map(row => row.version), [1], "batch excludes the current snapshot");
  assert.equal(batch.histories[0].prescriptionId, prescription.prescription.id);
  assert.deepEqual(batch.histories[0].history[0].snapshot, history.history[0].snapshot, "batch preserves immutable clinical snapshots");
  const prescriptionsAfterDoctorEdit = await expectStatus(request("/api/prescriptions", { cookie: admin }), 200, "prescription details should be readable");
  const doctorEditedPrescription = prescriptionsAfterDoctorEdit.prescriptions.find(item => item.id === prescription.prescription.id);
  assert.equal(doctorEditedPrescription.createdByRole, "doctor", "prescription list must expose the authenticated creator role");
  assert.equal(doctorEditedPrescription.updatedByRole, "doctor", "prescription list must expose the latest editor role");
  const adminPrescription = await expectStatus(request("/api/prescriptions", {
    method: "POST", cookie: admin,
    body: { patientId: second.patient.id, diagnosis: `${run} administrator diagnosis`, dialysisRx: { duration: "4 Hours" }, medications: [], notes: "created by administrator" },
  }), 201, "admin should create a prescription");
  ids.prescriptions.push(adminPrescription.prescription.id);
  const combinedBatch = await expectStatus(request("/api/prescription-histories", {
    method: "POST", cookie: doctor,
    body: { prescriptions: [
      { id: prescription.prescription.id, version: 2 },
      { id: adminPrescription.prescription.id, version: 1 },
    ] },
  }), 200, "doctors can batch histories from both staff roles");
  assert.equal(combinedBatch.histories.length, 2);
  assert.deepEqual(combinedBatch.histories.find(row => row.prescriptionId === adminPrescription.prescription.id).history, [], "new prescriptions have an explicit empty prior history");
  await expectStatus(request("/api/prescription-histories", {
    method: "POST", cookie: admin, body: { prescriptions: Array.from({ length: 501 }, () => batchBody.prescriptions[0]) },
  }), 400, "batch history queries have a bounded input size");
  const doctorAfterAdminCreation = await expectStatus(request("/api/notifications", { cookie: doctor }), 200, "doctor notifications remain readable");
  assert.ok(!doctorAfterAdminCreation.notifications.some(n => n.message === "Prescription created" && n.detail.includes(`${run}-SECOND`)),
    "a new patient without an explicit clinical link must not broadcast prescription alerts to unrelated doctors");
  const adminAfterOwnCreation = await expectStatus(request("/api/notifications", { cookie: admin }), 200, "administrator notifications should remain role-scoped");
  assert.ok(!adminAfterOwnCreation.notifications.some(n => n.message === "Prescription created" && n.detail.includes(`${run}-SECOND`)), "the creating administrator must not receive their own creation notification");
  const refreshedAdminCreated = await expectStatus(request("/api/prescriptions", { cookie: doctor }), 200, "new prescription data should persist after refresh");
  assert.equal(refreshedAdminCreated.prescriptions.find(item => item.id === adminPrescription.prescription.id)?.createdByRole, "admin", "administrator creation metadata must persist across portals");
  const adminNotifications = await expectStatus(request("/api/notifications", { cookie: admin }), 200, "admin notifications should be readable");
  assert.ok(adminNotifications.notifications.some(n => n.detail.includes(`${run}-NEG`)), "doctor revision must notify admins");
  const doctorBeforeAdminRevision = await expectStatus(request("/api/notifications", { cookie: doctor }), 200, "doctor notifications should be readable");
  assert.ok(!doctorBeforeAdminRevision.notifications.some(n => n.message === "Prescription revised" && n.detail.includes(`${run}-NEG`)), "doctor must not see the admin-targeted revision notification");
  await expectStatus(request(`/api/prescriptions/${prescription.prescription.id}`, {
    method: "PATCH", cookie: admin, body: { baseVersion: 2, notes: `${run} admin revision` },
  }), 200, "admin should revise a prescription");
  const prescriptionsAfterAdminEdit = await expectStatus(request("/api/prescriptions", { cookie: doctor }), 200, "revised prescription metadata should be synchronized across roles");
  const adminEditedPrescription = prescriptionsAfterAdminEdit.prescriptions.find(item => item.id === prescription.prescription.id);
  assert.equal(adminEditedPrescription.createdByRole, "doctor", "creator metadata must remain immutable after later edits");
  assert.equal(adminEditedPrescription.updatedByRole, "admin", "latest editor metadata must come from the authenticated backend actor");
  const doctorNotifications = await expectStatus(request("/api/notifications", { cookie: doctor }), 200, "doctor notifications should be readable");
  assert.ok(doctorNotifications.notifications.some(n => n.detail.includes(`${run}-NEG`)), "admin revision must notify doctors");
  const analytics = await expectStatus(request("/api/analytics", { cookie: admin }), 200, "analytics should be readable by admin");
  assert.equal(typeof analytics.analytics, "object");
  await runBrowserPrescriptionCacheTest(prescription.prescription.id, admin, doctor);
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