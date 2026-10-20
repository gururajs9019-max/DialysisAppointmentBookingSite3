import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";

export async function verifySchedulingLinksInBrowser({ base, patient, unit, machine, doctor, rx, date, request, admin }) {
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
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button").filter({ has: page.getByText(unit.name, { exact: true }) }).first().click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
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
    const persisted = (await request("/api/sessions", admin)).sessions.find(s => s.id === session.id);
    assert.equal(persisted.doctor, doctor.name);
    assert.equal(persisted.prescriptionId, rx.id);
    await page.getByRole("button", { name: "Live Schedule", exact: true }).click();
    await page.getByLabel("Schedule date", { exact: true }).fill(date);
    const cardForStatus = status => page.getByRole("button")
      .filter({ has: page.getByText(patient.name, { exact: true }) })
      .filter({ hasText: "Slot 3" })
      .filter({ hasText: status });
    await cardForStatus("Waiting").click();
    await page.getByRole("button", { name: "Call Patient", exact: true }).click();
    await expect(page.getByRole("button", { name: "Start Treatment", exact: true })).toBeVisible();
    await expect(cardForStatus("Called")).toContainText("Called");
    assert.equal((await request("/api/sessions", admin)).sessions.find(s => s.id === session.id).status, "called");
    await page.getByRole("button", { name: "Start Treatment", exact: true }).click();
    await expect(cardForStatus("Running")).toContainText("Running");
    assert.equal((await request("/api/sessions", admin)).sessions.find(s => s.id === session.id).status, "running");
    assert.deepEqual(errors, [], "linked scheduling and Called controls have no browser runtime errors");
  } finally { await browser.close(); }
}
