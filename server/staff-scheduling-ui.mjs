import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";

export async function verifySchedulingLinksInBrowser({ base, patient, racePatient, unit, machine, secondUnit, secondMachine, doctor, rx, date, request, admin }) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(base);
    await page.getByRole("button", { name: /Administrator Portal/ }).click();
    await page.getByLabel("Username", { exact: true }).fill("admin1");
    await page.getByLabel("Password", { exact: true }).fill(process.env.STAFF_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await page.getByRole("heading", { name: /Today's Dialysis Patients/ }).waitFor();
    await page.getByRole("button", { name: "Assign Patient", exact: true }).first().click();
    await page.getByRole("button").filter({ has: page.getByText(patient.name, { exact: true }) }).first().click();
    await page.getByRole("button", { name: "Remove Treating Doctor", exact: true }).click();
    const removeDoctorDialog = page.getByRole("dialog", { name: "Remove treating doctor?" });
    await expect(removeDoctorDialog).toBeVisible();
    await removeDoctorDialog.getByRole("button", { name: "Remove Doctor", exact: true }).click();
    await expect(page.getByText("Treating doctor removed.", { exact: true })).toBeVisible();
    await expect(page.getByText("Not assigned", { exact: true })).toBeVisible();
    const updatedPatient = await request(`/api/patients/${patient.id}`, admin);
    assert.equal(updatedPatient.patient.treatingNephrologist, "", "doctor removal persists on the patient record");
    assert.equal(updatedPatient.patient.name, patient.name, "doctor removal leaves the patient's name unchanged");
    assert.equal(updatedPatient.patient.uhid, patient.uhid, "doctor removal leaves the patient's identifier unchanged");
    assert.equal(updatedPatient.patient.treatmentStatus, "Active", "doctor removal leaves unrelated clinical status unchanged");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button").filter({ has: page.getByText(unit.name, { exact: true }) }).first().click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    const browserToday = await page.evaluate(() => {
      const current = new Date();
      return `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
    });
    assert.equal(await page.getByLabel("Machine availability date", { exact: true }).inputValue(), browserToday,
      "the assignment date defaults to the browser's local calendar date");
    await page.getByRole("button").filter({ has: page.getByText(machine.code, { exact: true }) }).first().click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: /Normal Slot/ }).click();
    await page.getByRole("button", { name: /Slot 3/ }).click();
    await page.locator('input[type="date"]').fill(date);
    await expect(page.getByLabel("Treating Doctor", { exact: true })).toBeEnabled();
    await page.getByLabel("Treating Doctor", { exact: true }).selectOption(doctor.id);
    const prescriptions = page.getByLabel("Dialysis Prescription", { exact: true });
    await expect(prescriptions.locator("option")).toHaveCount(2);
    await prescriptions.selectOption(rx.id);
    await page.getByRole("button", { name: "Assign Patient", exact: true }).last().click();
    const saved = page.waitForResponse(response =>
      new URL(response.url()).pathname === "/api/sessions" && response.request().method() === "POST");
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    const response = await saved;
    assert.equal(response.status(), 201);
    const { session } = await response.json();
    assert.equal(session.doctorId, doctor.id); assert.equal(session.prescriptionId, rx.id);
    assert.equal(session.patientId, patient.id);
    assert.equal(session.date, date, "the manually selected assignment date is saved");
    const persisted = (await request("/api/sessions", admin)).sessions.find(s => s.id === session.id);
    assert.equal(persisted.doctor, doctor.name);
    assert.equal(persisted.prescriptionId, rx.id);
    assert.equal(persisted.patientId, patient.id);
    assert.equal(persisted.date, date, "the selected appointment date survives a fresh read");
    await page.getByRole("button", { name: "New Assignment", exact: true }).click();
    await page.getByRole("button").filter({ has: page.getByText(racePatient.name, { exact: true }) }).first().click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button").filter({ has: page.getByText(secondUnit.name, { exact: true }) }).first().click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByLabel("Machine availability date", { exact: true }).fill(date);
    await page.getByRole("button").filter({ has: page.getByText(secondMachine.code, { exact: true }) }).first().click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    const alreadyScheduledPatient = page.getByRole("button").filter({ has: page.getByText(patient.name, { exact: true }) }).first();
    await expect(alreadyScheduledPatient).toBeDisabled();
    await expect(alreadyScheduledPatient).toContainText("Already in Live Schedule");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: /Normal Slot/ }).click();
    await page.getByRole("button", { name: /Slot 1/ }).click();
    await page.getByLabel("Appointment date", { exact: true }).fill(date);
    const externallySaved = await request("/api/sessions", admin, "POST", {
      patientId: racePatient.id, unitId: secondUnit.id, machineId: secondMachine.id, date, slot: "Slot 1",
    }, 201);
    assert.equal(externallySaved.session.patientId, racePatient.id);
    await page.getByRole("main").getByRole("button", { name: "Assign Patient", exact: true }).click();
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    const staleScheduleError = page.getByRole("alert").filter({ hasText: "You can retry without creating a duplicate." });
    await expect(staleScheduleError).toContainText("already in the Live Schedule");
    const racePatientSessions = (await request("/api/sessions", admin)).sessions.filter(s =>
      s.patientId === racePatient.id && s.date === date && !["cancelled", "missed"].includes(String(s.status).toLowerCase())
    );
    assert.equal(racePatientSessions.length, 1, "a schedule change made while the form is open prevents the duplicate save");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: "Live Schedule", exact: true }).click();
    await page.getByLabel("Schedule date", { exact: true }).fill(date);
    const cardForStatus = status => page.getByRole("button")
      .filter({ has: page.getByText(patient.name, { exact: true }) })
      .filter({ hasText: "Slot 3" })
      .filter({ hasText: status });
    await cardForStatus("Waiting").click();
    await expect(page.getByRole("button", { name: "Call Patient", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Start Treatment", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Start Treatment", exact: true }).click();
    await expect(cardForStatus("Running")).toContainText("Running");
    assert.equal((await request("/api/sessions", admin)).sessions.find(s => s.id === session.id).status, "running");
    assert.deepEqual(errors, [], "linked scheduling and manual start control have no browser runtime errors");
  } finally { await browser.close(); }
}
