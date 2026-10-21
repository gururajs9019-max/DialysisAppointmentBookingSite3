import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { chromium, expect } from "@playwright/test";

const base = process.env.TEST_BASE_URL || "http://127.0.0.1:5000";
const db = new Pool({ connectionString: process.env.DATABASE_URL });
const run = `RXCREATE-${randomUUID().slice(0, 8)}`;
const patientIds = [];
let browser;

async function request(path, cookie, method = "GET", body) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    data: await response.json(),
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}
async function expectRequest(path, cookie, method, body, status = 200) {
  const result = await request(path, cookie, method, body);
  assert.equal(result.status, status, `${method} ${path}: ${result.data.error || ""}`);
  return result;
}

try {
  const admin = (await expectRequest("/api/auth/login", null, "POST", {
    role: "admin", identifier: "admin1", password: process.env.STAFF_ADMIN_PASSWORD,
  })).cookie;
  const doctorLogin = await expectRequest("/api/auth/login", null, "POST", {
    role: "doctor", identifier: "doctor1", password: process.env.STAFF_DOCTOR_PASSWORD,
  });
  const doctor = doctorLogin.cookie;
  const adminId = (await db.query("SELECT id FROM portal_users WHERE username='admin1'")).rows[0].id;
  const doctorId = (await db.query("SELECT id FROM portal_users WHERE username='doctor1'")).rows[0].id;
  async function patient(suffix) {
    const created = (await expectRequest("/api/patients", admin, "POST", {
      name: `${run} ${suffix}`, uhid: `${run}-${suffix}`, age: 47, gender: "Female", treatmentStatus: "Active",
    }, 201)).data.patient;
    patientIds.push(created.id);
    return created;
  }
  const firstPatient = await patient("api");
  const uiPatient = await patient("ui");
  const creationBody = {
    requestId: randomUUID(), patientId: firstPatient.id, medicationOrders: true,
    prescriptionDate: "2026-10-19", diagnosis: `${run} diagnosis`,
    symptoms: "Synthetic symptoms", investigationFindings: "Synthetic findings", advice: "Synthetic advice",
    dietaryAdvice: "Synthetic dietary advice", followUpDate: "2026-11-19", notes: "Synthetic additional notes",
    medications: [{
      name: "Synthetic medicine", strength: "10 mg", dose: "1 tablet", route: "Oral",
      frequency: "Daily", duration: "5 days", quantity: "5", instructions: "Synthetic instructions",
    }],
    doctorId: "untrusted-doctor", createdBy: "Untrusted creator",
  };
  await expectRequest("/api/prescriptions", null, "POST", creationBody, 401);
  for (const invalid of [
    { patientId: "missing" }, { diagnosis: "" }, { prescriptionDate: "2026-02-30" },
    { medications: [] }, { medications: [{ dose: "1 tablet" }] }, { medicationOrders: "yes" },
  ]) {
    await expectRequest("/api/prescriptions", doctor, "POST", { ...creationBody, ...invalid }, invalid.patientId ? 404 : 400);
  }
  const concurrent = await Promise.all([1, 2].map(() => request("/api/prescriptions", doctor, "POST", creationBody)));
  assert.deepEqual(concurrent.map(result => result.status).sort(), [200, 201], "concurrent retries create one prescription");
  const prescriptionId = concurrent[0].data.prescription.id;
  assert.equal(concurrent[1].data.prescription.id, prescriptionId);
  const stored = (await db.query("SELECT * FROM prescriptions WHERE id=$1", [prescriptionId])).rows[0];
  assert.equal(stored.created_by, doctorId, "auth identity wins over supplied doctor metadata");
  assert.equal(stored.patient_id, firstPatient.id);
  assert.deepEqual(stored.data.medications, creationBody.medications);
  assert.equal(stored.data.followUpDate, creationBody.followUpDate);
  assert.equal((await db.query("SELECT count(*)::int count FROM prescription_versions WHERE prescription_id=$1", [prescriptionId])).rows[0].count, 1);
  assert.equal((await db.query("SELECT count(*)::int count FROM audit_logs WHERE entity_id=$1 AND action='prescription.create'", [prescriptionId])).rows[0].count, 1);
  await expectRequest("/api/prescriptions", doctor, "POST", { ...creationBody, diagnosis: "Different request" }, 409);
  const second = (await expectRequest("/api/prescriptions", doctor, "POST", {
    ...creationBody, requestId: randomUUID(), diagnosis: `${run} second prescription`,
  }, 201)).data.prescription;
  assert.notEqual(second.id, prescriptionId);
  assert.deepEqual((await db.query("SELECT data FROM prescriptions WHERE id=$1", [prescriptionId])).rows[0].data, stored.data,
    "a new prescription never replaces the previous record");
  await expectRequest(`/api/prescriptions/${prescriptionId}`, null, "PATCH", { baseVersion: 1, notes: "Unauthorized" }, 401);
  await expectRequest(`/api/prescriptions/${prescriptionId}`, doctor, "PATCH", { baseVersion: 1, notes: "Synthetic revision" });
  const history = (await expectRequest(`/api/prescriptions/${prescriptionId}/history`, doctor)).data.history;
  assert.deepEqual(history.map(version => version.version), [1, 2]);
  assert.deepEqual(history[0].snapshot, stored.data, "creation remains an immutable historical version");
  assert.deepEqual(history[1].snapshot.medications, stored.data.medications, "editing existing fields retains full medication details");

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  async function signIn() {
    await page.getByRole("button", { name: /Doctor Portal/ }).click();
    await page.locator('input[name="email"]').fill("doctor@kmcri.test");
    await page.locator('input[name="password"]').fill(process.env.STAFF_DOCTOR_PASSWORD);
    await page.getByRole("button", { name: "Login to Portal", exact: true }).click();
    await expect(page.getByRole("heading", { name: "KMC-RI Doctor Portal", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Prescriptions", exact: true }).first().click();
  }
  await page.goto(base);
  await signIn();
  await expect(page.getByRole("combobox", { name: "Prescribing staff" })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Prescription date" })).toHaveCount(0);
  await page.getByRole("button", { name: "Create Prescription", exact: true }).click();
  await page.getByText("Medical prescription", { exact: true }).click();
  const form = page.locator('section[aria-labelledby="create-prescription-title"]');
  await expect(form.getByRole("textbox", { name: "Prescription date" })).toHaveCount(0);
  const save = form.getByRole("button", { name: "Save Prescription", exact: true });
  await save.click();
  await expect(form.getByRole("alert")).toContainText("Select a registered active patient");
  async function selectUiPatient() {
    await form.getByLabel("Search registered patients by name or patient ID").fill(uiPatient.uhid);
    await form.getByRole("button").filter({ has: page.getByText(uiPatient.name, { exact: true }) }).click();
  }
  await selectUiPatient();
  await expect(form).toContainText("Age: 47");
  await expect(form).toContainText("Gender: Female");
  await expect(form).toContainText("No previous prescriptions are recorded");
  await save.click();
  await expect(form.getByRole("alert")).toContainText("Enter a diagnosis");
  await form.getByLabel("Diagnosis", { exact: false }).fill(`${run} UI diagnosis`);
  await form.getByLabel("Symptoms or clinical notes").fill("Synthetic UI symptoms");
  await form.getByLabel("Investigation findings").fill("Synthetic UI findings");
  await form.getByLabel("Doctor's advice").fill("Synthetic UI advice");
  await form.getByLabel("Dietary advice").fill("Synthetic UI diet");
  await form.getByLabel("Follow-up date").fill("2026-11-19");
  await form.getByLabel("Additional notes", { exact: true }).fill("Synthetic UI notes");
  await form.locator("#medicine-0-name").fill("Synthetic UI medicine A");
  await form.locator("#medicine-0-strength").fill("20 mg");
  await form.locator("#medicine-0-dose").fill("1 tablet");
  await form.locator("#medicine-0-route").fill("Oral");
  await form.locator("#medicine-0-frequency").fill("Daily");
  await form.locator("#medicine-0-duration").fill("3 days");
  await form.locator("#medicine-0-quantity").fill("3");
  await form.locator("#medicine-0-instructions").fill("Synthetic UI instructions");
  await form.getByRole("button", { name: "Add Medicine", exact: true }).click();
  await form.locator("#medicine-1-name").fill("Synthetic UI medicine B");
  await form.getByRole("button", { name: "Add Medicine", exact: true }).click();
  await form.getByRole("button", { name: "Remove medicine 3", exact: true }).click();
  await expect(form.locator('input[id^="medicine-"][id$="-name"]')).toHaveCount(2);

  let attempts = 0;
  const requestIds = [];
  let committedId;
  await page.route("**/api/prescriptions", async route => {
    if (route.request().method() !== "POST") return route.continue();
    attempts++;
    requestIds.push(route.request().postDataJSON().requestId);
    if (attempts === 1) {
      await expect(form.getByRole("button", { name: "Saving…", exact: true })).toBeDisabled();
      return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Synthetic temporary save failure" }) });
    }
    if (attempts === 2) {
      const response = await route.fetch();
      assert.equal(response.status(), 201);
      committedId = (await response.json()).prescription.id;
      return route.abort("failed"); // Simulate a lost response after the transaction committed.
    }
    return route.continue();
  });
  await save.click();
  await expect(form.getByRole("alert")).toContainText("Synthetic temporary save failure");
  await expect(form.locator("#medicine-0-strength")).toHaveValue("20 mg");
  await save.click();
  await expect(form.getByRole("alert")).toContainText("Check your connection");
  await expect(form.getByLabel("Diagnosis", { exact: false })).toHaveValue(`${run} UI diagnosis`);
  await save.click();
  await expect(page.getByRole("status")).toContainText("Prescription created successfully.");
  assert.equal(new Set(requestIds).size, 1, "all failed-save retries retain one idempotency identity");
  let uiRows = (await db.query("SELECT * FROM prescriptions WHERE patient_id=$1", [uiPatient.id])).rows;
  assert.equal(uiRows.length, 1, "the lost successful response does not create a duplicate");
  assert.equal(uiRows[0].id, committedId);
  assert.equal(uiRows[0].data.medications.length, 2);
  assert.match(uiRows[0].data.prescriptionDate, /^\d{4}-\d{2}-\d{2}$/, "the hidden date is still stored for the medical-order API");
  assert.equal(uiRows[0].data.medications[0].quantity, "3");
  assert.equal(uiRows[0].data.medications[0].instructions, "Synthetic UI instructions");
  await expect(page.getByText("Synthetic UI instructions", { exact: false })).toHaveCount(0);
  await page.reload();
  await signIn();
  await page.getByPlaceholder("Search by patient name or UHID…").fill(uiPatient.uhid);
  const persistedMedicine = page.getByText("Synthetic UI medicine A", { exact: false });
  if (!(await persistedMedicine.isVisible())) {
    await page.getByRole("button").filter({ hasText: uiRows[0].id }).first().click();
  }
  await expect(persistedMedicine).toBeVisible();
  for (const hiddenValue of [
    `${run} UI diagnosis`, "Synthetic UI symptoms", "Synthetic UI findings", "Synthetic UI advice",
    "Synthetic UI diet", "2026-11-19", uiRows[0].data.prescriptionDate,
    "Prescribed by", "Quantity:", "Instructions:", "Synthetic UI instructions",
  ]) {
    await expect(page.getByText(hiddenValue, { exact: false })).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Edit Prescription", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Prescription date" })).toHaveCount(0);
  for (const label of [
    "Diagnosis", "Symptoms / clinical notes", "Investigation findings", "Doctor's advice", "Dietary advice", "Follow-up date",
  ]) {
    await expect(page.getByText(label, { exact: true })).toHaveCount(0);
  }
  await expect(page.getByRole("columnheader", { name: "Quantity", exact: true })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "Instructions", exact: true })).toHaveCount(0);
  const doctorSave = page.getByRole("button", { name: "Save Changes", exact: true });
  const doctorNotes = page.getByLabel("Clinical Notes", { exact: true });
  await doctorSave.scrollIntoViewIfNeeded();
  const doctorSaveTop = await doctorSave.evaluate(element => element.getBoundingClientRect().top);
  const doctorNotesTop = await doctorNotes.evaluate(element => element.getBoundingClientRect().top);
  assert.ok(doctorSaveTop > doctorNotesTop, "Doctor Save Changes appears after the prescription fields");
  await doctorNotes.fill("Synthetic UI notes after Doctor edit");
  await doctorSave.click();
  await expect(page.getByText("Prescription changes saved successfully.", { exact: true })).toBeVisible();
  const doctorRevisedMedical = (await db.query("SELECT * FROM prescriptions WHERE id=$1", [uiRows[0].id])).rows[0];
  assert.equal(doctorRevisedMedical.data.notes, "Synthetic UI notes after Doctor edit");
  assert.equal(doctorRevisedMedical.data.prescriptionDate, uiRows[0].data.prescriptionDate);
  for (const field of ["diagnosis", "symptoms", "investigationFindings", "advice", "dietaryAdvice", "followUpDate"]) {
    assert.equal(doctorRevisedMedical.data[field], uiRows[0].data[field], `Doctor edit preserves ${field}`);
  }
  assert.equal(doctorRevisedMedical.data.medications[0].quantity, "3", "hidden quantity is preserved when a Doctor edits");
  assert.equal(doctorRevisedMedical.data.medications[0].instructions, "Synthetic UI instructions", "hidden instructions are preserved when a Doctor edits");
  await page.getByRole("button", { name: "Create Prescription", exact: true }).click();
  await page.getByText("Medical prescription", { exact: true }).click();
  await selectUiPatient();
  await expect(form.getByRole("heading", { name: `Previous prescriptions for ${uiPatient.name}` })).toBeVisible();
  await expect(form.getByRole("textbox", { name: "Prescription date" })).toHaveCount(0);
  await expect(form.getByText("Prescribed by", { exact: false })).toHaveCount(0);
  await expect(form.getByText(`${run} UI diagnosis`, { exact: true })).toHaveCount(0);
  await expect(form).toContainText("Synthetic UI medicine A");
  await page.setViewportSize({ width: 900, height: 1100 });
  assert.equal(await form.evaluate(element => element.getBoundingClientRect().right <= window.innerWidth), true, "form fits the tablet viewport");
  await page.screenshot({ path: "/tmp/doctor-prescription-create-tablet.png", fullPage: true });
  await form.getByLabel("Diagnosis", { exact: false }).fill(`${run} UI follow-on prescription`);
  await form.locator("#medicine-0-name").fill("Synthetic UI medicine C");
  await save.click();
  await expect(page.getByRole("status")).toContainText("Prescription created successfully.");
  uiRows = (await db.query("SELECT * FROM prescriptions WHERE patient_id=$1 ORDER BY created_at", [uiPatient.id])).rows;
  assert.equal(uiRows.length, 2, "a patient with history can receive a new separate prescription");
  assert.equal(uiRows[0].data.diagnosis, `${run} UI diagnosis`, "the original prescription is unchanged");
  await page.getByRole("button", { name: "Create Prescription", exact: true }).click();
  await page.getByText("Dialysis prescription", { exact: true }).click();
  const dialysisForm = page.locator('section[aria-labelledby="create-dialysis-prescription-title"]');
  await expect(dialysisForm.getByRole("textbox", { name: "Prescription date" })).toHaveCount(0);
  await dialysisForm.getByLabel("Search active patients by name or patient ID").fill(uiPatient.uhid);
  await dialysisForm.getByRole("button").filter({ has: page.getByText(uiPatient.name, { exact: true }) }).click();
  const doctorWeeklyCount = dialysisForm.getByLabel("Weekly Dialysis Sessions", { exact: true });
  await expect(doctorWeeklyCount).toHaveValue("0");
  await dialysisForm.getByRole("button", { name: "Monday", exact: true }).click();
  await dialysisForm.getByRole("button", { name: "Wednesday", exact: true }).click();
  await expect(doctorWeeklyCount).toHaveValue("2");
  await dialysisForm.getByLabel("Time slot").selectOption("8:00 AM – 12:00 PM");
  await dialysisForm.getByLabel("Session duration").selectOption("4 Hours");
  await dialysisForm.getByLabel("Blood flow rate").fill("300 mL/min");
  await dialysisForm.getByLabel("Additional instructions").fill("Synthetic dialysis instructions");
  await dialysisForm.getByRole("button", { name: "Create Dialysis Prescription", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Prescription created successfully.");
  uiRows = (await db.query("SELECT * FROM prescriptions WHERE patient_id=$1 ORDER BY created_at", [uiPatient.id])).rows;
  assert.equal(uiRows.length, 3, "dialysis prescriptions are saved as separate patient records");
  const dialysisRecord = uiRows.find(row => row.data.medicationOrders === false);
  assert.ok(dialysisRecord, "dialysis prescription is distinct from medical medicine orders");
  assert.deepEqual(dialysisRecord.data.dialysisRx.dialysisDays, ["Monday", "Wednesday"]);
  assert.equal(dialysisRecord.data.dialysisRx.weeklySessionsCount, "2");
  assert.equal(dialysisRecord.data.dialysisRx.bloodFlow, "300 mL/min");
  assert.equal(dialysisRecord.data.notes, "Synthetic dialysis instructions");
  assert.deepEqual(dialysisRecord.data.medications, []);

  const adminPage = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const adminErrors = [];
  adminPage.on("pageerror", error => adminErrors.push(error.message));
  async function signInAdmin() {
    if (!(await adminPage.getByRole("button", { name: "Prescriptions", exact: true }).isVisible().catch(() => false))) {
      await adminPage.getByRole("button", { name: "Administrator Portal" }).click();
      if (await adminPage.getByLabel("Username").isVisible().catch(() => false)) {
        await adminPage.getByLabel("Username").fill("admin1");
        await adminPage.getByLabel("Password").fill(process.env.STAFF_ADMIN_PASSWORD);
        await adminPage.getByRole("button", { name: "Sign In", exact: true }).click();
      }
    }
    await expect(adminPage.getByRole("button", { name: "Prescriptions", exact: true })).toBeVisible();
  }
  await adminPage.goto(base);
  await signInAdmin();
  await adminPage.getByRole("button", { name: "Prescriptions", exact: true }).click();
  await expect(adminPage.getByRole("heading", { name: "Prescription Management", exact: true })).toBeVisible();
  await adminPage.getByPlaceholder("Search by patient name or UHID…").fill(uiPatient.uhid);
  await adminPage.getByLabel("Prescription type").selectOption("Medical");
  await expect(adminPage.getByRole("combobox", { name: "Prescribing staff" })).toHaveCount(0);
  await expect(adminPage.getByRole("textbox", { name: "Prescription date" })).toHaveCount(0);
  const doctorMedicalRecord = uiRows.find(row => row.data.diagnosis === `${run} UI diagnosis`);
  assert.ok(doctorMedicalRecord, "a medical record should exist for Administrator view checks");
  const adminMedicalCard = adminPage.getByRole("button").filter({ hasText: uiPatient.uhid }).filter({ hasText: doctorMedicalRecord.id }).first();
  const visibleMedicineA = adminPage.getByText("Synthetic UI medicine A", { exact: false });
  if (!(await visibleMedicineA.isVisible())) await adminMedicalCard.click();
  await expect(visibleMedicineA).toBeVisible();
  for (const hiddenValue of [
    `${run} UI diagnosis`, "Synthetic UI symptoms", "Synthetic UI findings", "Synthetic UI advice",
    "Synthetic UI diet", "2026-11-19", "Prescribed by", "Quantity:", "Instructions:", "Synthetic UI instructions",
  ]) {
    await expect(adminPage.getByText(hiddenValue, { exact: false })).toHaveCount(0);
  }
  await expect(adminPage.getByText(doctorMedicalRecord.data.prescriptionDate, { exact: true })).toHaveCount(0);
  await adminPage.getByRole("button", { name: "Edit Prescription", exact: true }).click();
  await expect(adminPage.getByRole("textbox", { name: "Prescription date" })).toHaveCount(0);
  for (const label of [
    "Diagnosis", "Symptoms / clinical notes", "Investigation findings", "Doctor's advice", "Dietary advice", "Follow-up date",
  ]) {
    await expect(adminPage.getByText(label, { exact: true })).toHaveCount(0);
  }
  const editSave = adminPage.getByRole("button", { name: "Save Changes", exact: true });
  const clinicalNotes = adminPage.getByLabel("Clinical Notes", { exact: true });
  await editSave.scrollIntoViewIfNeeded();
  const saveTop = await editSave.evaluate(element => element.getBoundingClientRect().top);
  const notesTop = await clinicalNotes.evaluate(element => element.getBoundingClientRect().top);
  assert.ok(saveTop > notesTop, "Administrator Save Changes must appear after the prescription fields");
  await clinicalNotes.fill(`${run} Admin updated notes`);
  await editSave.click();
  await expect(adminPage.getByText("Prescription changes saved successfully.", { exact: true })).toBeVisible();
  const adminRevisedMedical = (await db.query("SELECT * FROM prescriptions WHERE id=$1", [doctorMedicalRecord.id])).rows[0];
  assert.equal(adminRevisedMedical.data.notes, `${run} Admin updated notes`);
  assert.equal(adminRevisedMedical.data.prescriptionDate, doctorMedicalRecord.data.prescriptionDate, "the hidden date remains unchanged on edit");
  for (const field of ["diagnosis", "symptoms", "investigationFindings", "advice", "dietaryAdvice", "followUpDate"]) {
    assert.equal(adminRevisedMedical.data[field], doctorMedicalRecord.data[field], `Administrator edit preserves ${field}`);
  }
  assert.equal(adminRevisedMedical.data.medications[0].quantity, "3", "hidden quantity stays stored after edits");
  assert.equal(adminRevisedMedical.data.medications[0].instructions, "Synthetic UI instructions", "hidden instructions stay stored after edits");
  await adminPage.getByRole("button", { name: "Create Prescription", exact: true }).click();
  await adminPage.getByText("Medical prescription", { exact: true }).click();
  const adminForm = adminPage.locator('section[aria-labelledby="create-prescription-title"]');
  await expect(adminForm.getByRole("textbox", { name: "Prescription date" })).toHaveCount(0);
  await adminForm.getByLabel("Search registered patients by name or patient ID").fill(uiPatient.uhid);
  await adminForm.getByRole("button").filter({ has: adminPage.getByText(uiPatient.name, { exact: true }) }).click();
  await expect(adminForm.getByText("Prescribed by", { exact: false })).toHaveCount(0);
  await expect(adminForm.getByText(`${run} UI diagnosis`, { exact: true })).toHaveCount(0);
  await adminForm.getByLabel("Diagnosis", { exact: false }).fill(`${run} Administrator prescription`);
  await adminForm.locator("#medicine-0-name").fill("Administrator synthetic medication");
  await adminForm.getByRole("button", { name: "Save Prescription", exact: true }).click();
  await expect(adminPage.getByRole("status")).toContainText("Prescription created successfully.");
  const adminCreated = (await db.query(
    "SELECT * FROM prescriptions WHERE patient_id=$1 AND data->>'diagnosis'=$2", [uiPatient.id, `${run} Administrator prescription`],
  )).rows[0];
  assert.ok(adminCreated, "administrator prescription page creates a real record");
  assert.equal(adminCreated.created_by, adminId, "administrator identity is recorded as the creator");
  assert.match(adminCreated.data.prescriptionDate, /^\d{4}-\d{2}-\d{2}$/, "the hidden date still satisfies the medical-order API");

  await adminPage.getByRole("button", { name: "Create Prescription", exact: true }).click();
  await adminPage.getByText("Dialysis prescription", { exact: true }).click();
  const adminDialysisForm = adminPage.locator('section[aria-labelledby="create-dialysis-prescription-title"]');
  await expect(adminDialysisForm.getByRole("textbox", { name: "Prescription date" })).toHaveCount(0);
  await adminDialysisForm.getByLabel("Search active patients by name or patient ID").fill(uiPatient.uhid);
  await adminDialysisForm.getByRole("button").filter({ has: adminPage.getByText(uiPatient.name, { exact: true }) }).click();
  await expect(adminDialysisForm.getByText("Prescribed by", { exact: false })).toHaveCount(0);
  await expect(adminDialysisForm.getByText(`${run} UI diagnosis`, { exact: true })).toHaveCount(0);
  const weeklyCount = adminDialysisForm.getByLabel("Weekly Dialysis Sessions", { exact: true });
  await expect(weeklyCount).toHaveValue("0");
  await adminDialysisForm.getByRole("button", { name: "Monday", exact: true }).click();
  await adminDialysisForm.getByRole("button", { name: "Thursday", exact: true }).click();
  await adminDialysisForm.getByRole("button", { name: "Saturday", exact: true }).click();
  await expect(weeklyCount).toHaveValue("3");
  await adminDialysisForm.getByRole("button", { name: "Saturday", exact: true }).click();
  await expect(weeklyCount).toHaveValue("2");
  await adminDialysisForm.getByRole("button", { name: "Saturday", exact: true }).click();
  await expect(weeklyCount).toHaveValue("3");
  await adminDialysisForm.getByLabel("Time slot").selectOption("8:00 AM – 12:00 PM");
  await adminDialysisForm.getByLabel("Session duration").selectOption("4 Hours");
  const appointmentsBeforePrescription = (await db.query(
    "SELECT count(*)::int AS count FROM dialysis_sessions WHERE patient_id=$1", [uiPatient.id],
  )).rows[0].count;
  await adminDialysisForm.getByRole("button", { name: "Create Dialysis Prescription", exact: true }).click();
  await expect(adminPage.getByRole("status")).toContainText("Prescription created successfully.");
  let adminDialysisRecord = (await db.query(
    "SELECT * FROM prescriptions WHERE patient_id=$1 AND created_by=$2 AND data->>'medicationOrders'='false' ORDER BY created_at DESC LIMIT 1",
    [uiPatient.id, adminId],
  )).rows[0];
  assert.ok(adminDialysisRecord, "administrator can create a dialysis prescription");
  assert.equal(adminDialysisRecord.data.dialysisRx.weeklySessionsCount, "3");
  assert.deepEqual(adminDialysisRecord.data.dialysisRx.dialysisDays, ["Monday", "Thursday", "Saturday"]);
  assert.equal((await db.query(
    "SELECT count(*)::int AS count FROM dialysis_sessions WHERE patient_id=$1", [uiPatient.id],
  )).rows[0].count, appointmentsBeforePrescription, "changing prescription days must not modify appointments");

  await adminPage.getByLabel("Prescription type").selectOption("Dialysis");
  let adminDialysisHeader = adminPage.getByRole("button").filter({ hasText: adminDialysisRecord.id }).first();
  let adminDialysisCard = adminDialysisHeader.locator("xpath=..");
  let weeklyDetails = adminDialysisCard.getByText("Weekly Dialysis Sessions", { exact: true }).locator("xpath=..");
  if (!(await weeklyDetails.isVisible())) await adminDialysisHeader.click();
  await expect(weeklyDetails).toContainText("3");
  await adminDialysisCard.getByRole("button", { name: "Edit Prescription", exact: true }).click();
  const editWeeklyCount = adminDialysisCard.getByLabel("Weekly Dialysis Sessions", { exact: true });
  await expect(editWeeklyCount).toHaveValue("3");
  await expect(adminDialysisCard.getByRole("button", { name: "Sat", exact: true })).toHaveAttribute("aria-pressed", "true");
  await adminDialysisCard.getByRole("button", { name: "Sat", exact: true }).click();
  await expect(editWeeklyCount).toHaveValue("2");
  const dialysisSave = adminDialysisCard.getByRole("button", { name: "Save Changes", exact: true });
  const dialysisNotes = adminDialysisCard.getByLabel("Clinical Notes", { exact: true });
  await dialysisSave.scrollIntoViewIfNeeded();
  const dialysisSaveTop = await dialysisSave.evaluate(element => element.getBoundingClientRect().top);
  const dialysisNotesTop = await dialysisNotes.evaluate(element => element.getBoundingClientRect().top);
  assert.ok(dialysisSaveTop > dialysisNotesTop, "dialysis Save Changes must remain at the bottom of the form");
  await dialysisSave.click();
  await expect(adminPage.getByText("Prescription changes saved successfully.", { exact: true })).toBeVisible();
  adminDialysisRecord = (await db.query("SELECT * FROM prescriptions WHERE id=$1", [adminDialysisRecord.id])).rows[0];
  assert.equal(adminDialysisRecord.data.dialysisRx.weeklySessionsCount, "2");
  assert.deepEqual(adminDialysisRecord.data.dialysisRx.dialysisDays, ["Monday", "Thursday"]);
  assert.equal((await db.query(
    "SELECT count(*)::int AS count FROM dialysis_sessions WHERE patient_id=$1", [uiPatient.id],
  )).rows[0].count, appointmentsBeforePrescription, "editing prescription days must not modify appointments");
  assert.equal((await db.query("SELECT count(*)::int AS count FROM prescriptions WHERE patient_id=$1", [uiPatient.id])).rows[0].count, 5,
    "editing the existing prescription must not create a duplicate");
  weeklyDetails = adminDialysisCard.getByText("Weekly Dialysis Sessions", { exact: true }).locator("xpath=..");
  await expect(weeklyDetails).toContainText("2");

  await adminPage.reload();
  await signInAdmin();
  await adminPage.getByRole("button", { name: "Prescriptions", exact: true }).click();
  await adminPage.getByPlaceholder("Search by patient name or UHID…").fill(uiPatient.uhid);
  await adminPage.getByLabel("Prescription type").selectOption("Dialysis");
  adminDialysisHeader = adminPage.getByRole("button").filter({ hasText: adminDialysisRecord.id }).first();
  adminDialysisCard = adminDialysisHeader.locator("xpath=..");
  weeklyDetails = adminDialysisCard.getByText("Weekly Dialysis Sessions", { exact: true }).locator("xpath=..");
  if (!(await weeklyDetails.isVisible())) await adminDialysisHeader.click();
  await expect(weeklyDetails).toContainText("2");
  await expect(adminDialysisCard.getByText("Monday", { exact: true })).toBeVisible();
  await expect(adminDialysisCard.getByText("Thursday", { exact: true })).toBeVisible();
  assert.deepEqual(adminErrors, [], "administrator prescription management has no browser runtime errors");
  assert.deepEqual(errors, [], "prescription creation has no browser runtime errors");
  console.log("prescription tests passed: shared staff-page privacy/layout, preserved medication data, days-derived dialysis counts, no appointment side effects, and working edits in both portals");
} finally {
  if (browser) await browser.close();
  const prescriptionIds = patientIds.length
    ? (await db.query("SELECT id FROM prescriptions WHERE patient_id=ANY($1::text[])", [patientIds])).rows.map(row => row.id)
    : [];
  await db.query("DELETE FROM notifications WHERE detail LIKE $1", [`%${run}%`]);
  await db.query("DELETE FROM audit_logs WHERE entity_id=ANY($1::text[])", [[...patientIds, ...prescriptionIds]]);
  await db.query("DELETE FROM prescription_versions WHERE prescription_id=ANY($1::text[])", [prescriptionIds]);
  await db.query("DELETE FROM prescriptions WHERE id=ANY($1::text[])", [prescriptionIds]);
  await db.query("DELETE FROM patients WHERE id=ANY($1::text[])", [patientIds]);
  await db.end();
}
