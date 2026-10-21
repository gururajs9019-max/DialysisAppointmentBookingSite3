import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";

export async function verifyAvailabilityBrowser({ base, patients, main, spare, maintenance, otherMachine, firstUnit, otherUnit }) {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ timezoneId: "Asia/Kolkata", viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    async function dashboard(reload = false) {
      if (reload) await page.reload({ waitUntil: "domcontentloaded" });
      else await page.goto(base);
      await page.getByRole("button", { name: "Administrator Portal" }).click();
      await page.getByLabel("Username", { exact: true }).fill("admin1");
      await page.getByLabel("Password", { exact: true }).fill(process.env.STAFF_ADMIN_PASSWORD);
      await page.getByRole("button", { name: "Sign In", exact: true }).click();
      await page.getByRole("heading", { name: "Today's Dialysis Patients" }).waitFor();
    }
    async function assignToday(patient) {
      const patientRow = page.locator("div.divide-y.divide-slate-50 > div.px-6.py-4").filter({ hasText: patient.uhid });
      await patientRow.getByRole("button", { name: "Assign", exact: true }).click();
      await page.getByRole("heading", { name: "Select Dialysis Unit", exact: false }).waitFor();
    }
    async function chooseUnit(unit) {
      await page.getByRole("button").filter({ has: page.getByText(unit.name, { exact: true }) }).first().click();
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.getByLabel("Machine availability time slot").waitFor();
    }
    const machineCard = machine => page.getByRole("button").filter({ has: page.getByText(machine.code, { exact: true }) });
    const slotButton = slot => page.getByRole("button", { name: new RegExp(`^Slot ${slot}\\b`) });
    const assignButton = () => page.getByRole("main").getByRole("button", { name: "Assign Patient", exact: true });
    await dashboard();
    await assignToday(patients[0]);
    await chooseUnit(firstUnit);
    await expect(page.getByLabel("Machine availability time slot")).toHaveValue("Slot 2");
    const localToday = await page.evaluate(() => {
      const current = new Date();
      return `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
    });
    await expect(page.getByLabel("Machine availability date")).toHaveValue(localToday);
    await expect(page.getByLabel("Machine availability date")).toHaveAttribute("type", "date");
    await expect(machineCard(maintenance)).toBeDisabled();
    await expect(machineCard(maintenance)).toContainText("Under Maintenance");
    await machineCard(main).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(slotButton(2)).toHaveAttribute("aria-pressed", "true");
    await page.getByText(/Default slot loaded from/).waitFor();
    await expect(page.getByLabel("Dialysis Prescription")).toHaveValue("");
    await slotButton(3).click();
    await expect(assignButton()).toBeDisabled();
    await page.getByText(/This machine is already reserved/).waitFor();
    await slotButton(1).click();
    await expect(assignButton()).toBeEnabled();
    const refreshed = page.waitForResponse(response => new URL(response.url()).pathname === "/api/units");
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await refreshed;
    await expect(slotButton(1)).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByLabel("Machine availability time slot")).toHaveValue("Slot 1");
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await chooseUnit(otherUnit);
    await expect(machineCard(main)).toHaveCount(0);
    await machineCard(otherMachine).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(slotButton(1)).toHaveAttribute("aria-pressed", "true");
    await assignButton().click();
    let posts = 0;
    page.on("request", request => {
      if (new URL(request.url()).pathname === "/api/sessions" && request.method() === "POST") posts++;
    });
    const saved = page.waitForResponse(response =>
      new URL(response.url()).pathname === "/api/sessions" && response.request().method() === "POST");
    await page.getByRole("button", { name: "Confirm", exact: true }).evaluate(button => { button.click(); button.click(); });
    const response = await saved, result = await response.json();
    assert.equal(response.status(), 201, result.error);
    await page.getByRole("heading", { name: "Assignment Confirmed" }).waitFor();
    assert.equal(posts, 1, "repeated confirmation clicks send only one reservation");
    assert.equal(result.session.slot, "Slot 1");
    assert.equal(result.session.machineId, otherMachine.id);
    await dashboard(true);
    await page.getByRole("button", { name: "Live Schedule", exact: true }).click();
    await page.getByLabel("Schedule date", { exact: true }).fill(result.session.date);
    const assignedCard = page.getByRole("button").filter({ hasText: patients[0].uhid }).first();
    await assignedCard.click();
    await page.getByRole("button", { name: "Reschedule Slot", exact: true }).click();
    await expect(page.getByLabel("Reschedule date")).toHaveValue(result.session.date);
    await expect(page.getByLabel("Reschedule unit")).toHaveValue(otherUnit.id);
    await expect(page.getByLabel("Reschedule machine")).toHaveValue(otherMachine.id);
    await expect(page.getByLabel("Reschedule time slot")).toHaveValue("Slot 1");
    await expect(page.getByText(`${otherMachine.code}: Available.`, { exact: true })).toBeVisible();
    await page.getByLabel("Reschedule unit").selectOption(firstUnit.id);
    await page.getByLabel("Reschedule machine").selectOption(main.id);
    await page.getByLabel("Reschedule time slot").selectOption("Slot 3");
    await expect(page.getByRole("button", { name: "Save Reschedule", exact: true })).toBeDisabled();
    await page.getByText(/This machine is already reserved/).waitFor();
    await expect(page.getByLabel("Reschedule machine")).toHaveValue(main.id);
    await page.getByLabel("Reschedule time slot").selectOption("Slot 2");
    await expect(page.getByRole("button", { name: "Save Reschedule", exact: true })).toBeEnabled();
    const rescheduled = page.waitForResponse(response =>
      new URL(response.url()).pathname === `/api/sessions/${result.session.id}` && response.request().method() === "PATCH");
    await page.getByRole("button", { name: "Save Reschedule", exact: true }).click();
    const rescheduledResponse = await rescheduled;
    assert.equal(rescheduledResponse.status(), 200);
    assert.equal((await rescheduledResponse.json()).session.id, result.session.id);
    await page.getByText("Appointment rescheduled successfully.", { exact: true }).waitFor();
    await dashboard(true);
    await page.getByRole("button", { name: "Live Schedule", exact: true }).click();
    await page.getByLabel("Schedule date", { exact: true }).fill(result.session.date);
    const persistedScheduleCard = page.getByRole("button").filter({ hasText: patients[0].uhid }).first();
    await persistedScheduleCard.click();
    await expect(page.getByText("Slot 2", { exact: true })).toBeVisible();
    await expect(page.getByText("12:00 PM – 4:00 PM", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Dashboard", exact: true }).click();
    await page.getByRole("heading", { name: "Today's Dialysis Patients" }).waitFor();
    for (const [patient, warning] of [[patients[3], /not one of the supported|unsupported/i], [patients[4], /No prescribed slot/i]]) {
      await assignToday(patient);
      await chooseUnit(firstUnit);
      await expect(page.getByLabel("Machine availability time slot")).toHaveValue("");
      await machineCard(spare).click();
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.getByText(warning).first().waitFor();
      await expect(assignButton()).toBeDisabled();
      await page.getByRole("button", { name: /Normal Slot/ }).click();
      await slotButton(1).click();
      await expect(assignButton()).toBeEnabled();
      await dashboard(true);
    }
    await page.setViewportSize({ width: 768, height: 1024 });
    await assignToday(patients[4]);
    await chooseUnit(firstUnit);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false,
      "availability machine list remains usable on tablet");
    assert.deepEqual(errors, [], "the Administrator workflow has no browser runtime errors");
    console.log("scheduling browser passed: prescribed/missing/unsupported defaults, persistent overrides, availability feedback, unit filtering, duplicate-click guard, self-excluding reschedule and refresh persistence");
  } finally { await browser.close(); }
}
