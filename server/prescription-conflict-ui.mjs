import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";

// Called by the integration suite with its own synthetic patient; cleanup stays
// in that suite's finally block. Never reads or changes unrelated prescriptions.
export async function runPrescriptionConflictUiTest({ baseUrl, patient, prescriptionId }) {
  const browser = await chromium.launch({ headless: true });
  const pages = {};
  try {
    async function open(role) {
      if (pages[role]) await pages[role].context().close();
      const context = await browser.newContext();
      const page = pages[role] = await context.newPage();
      await page.goto(baseUrl);
      await page.getByRole("button", { name: role === "admin" ? "Administrator Portal" : "Doctor Portal" }).click();
      if (role === "admin") {
        await page.getByLabel("Username").fill("admin1");
        await page.getByLabel("Password").fill(process.env.STAFF_ADMIN_PASSWORD);
        await page.getByRole("button", { name: "Sign In" }).click();
      } else {
        await page.locator('input[name="email"]').fill("doctor@kmcri.test");
        await page.locator('input[name="password"]').fill(process.env.STAFF_DOCTOR_PASSWORD);
        await page.getByRole("button", { name: "Login to Portal" }).click();
      }
      await page.getByRole("button", { name: role === "admin" ? "Treatment Status" : "Prescriptions", exact: true }).click();
      await page.getByPlaceholder("Search by patient name or UHID…").fill(patient.uhid);
    }

    async function edit(role) {
      const page = pages[role];
      if (!(await page.getByRole("button", { name: "Edit Prescription", exact: true }).isVisible())) {
        await page.getByRole("button").filter({ hasText: patient.name }).first().click();
      }
      await page.getByRole("button", { name: "Edit Prescription", exact: true }).click();
      await expect(page.getByText("Editing Prescription", { exact: true })).toBeVisible();
    }
    const saveButton = role => pages[role].getByRole("button", { name: role === "admin" ? "Save Prescription" : "Save Changes", exact: true });
    const conflict = role => pages[role].getByRole("region", { name: "Prescription conflict" });
    const clinicalNotes = role => pages[role].getByLabel("Clinical Notes", { exact: true });
    const readCurrent = () => pages.admin.evaluate(async id => {
      const data = await (await fetch("/api/prescriptions")).json();
      return data.prescriptions.find(rx => rx.id === id);
    }, prescriptionId);

    for (const [winner, loser] of [["admin", "doctor"], ["doctor", "admin"]]) {
      // Fresh staff loads ensure both independent forms start on the same base.
      await open("admin"); await open("doctor");
      const before = await readCurrent();
      await edit("admin"); await edit("doctor");
      const winningNote = `${patient.uhid} ${winner} saved`;
      const draftNote = `${patient.uhid} ${loser} unsaved`;
      await clinicalNotes(winner).fill(winningNote);
      await clinicalNotes(loser).fill(draftNote);
      await saveButton(winner).click();
      await expect(pages[winner].getByText("Editing Prescription", { exact: true })).toHaveCount(0);
      await saveButton(loser).click();
      await expect(conflict(loser)).toBeVisible();
      await expect(clinicalNotes(loser)).toHaveValue(draftNote);
      await expect(saveButton(loser)).toBeDisabled();
      assert.equal((await readCurrent()).notes, winningNote, "conflict must not overwrite winner");
      assert.equal((await readCurrent()).version, before.version + 1);

      if (loser === "admin") {
        // A failed reload stays recoverable, with no change to the draft.
        await pages[loser].route("**/api/prescriptions", route => route.fulfill({
          status: 503, contentType: "application/json", body: JSON.stringify({ error: "Comparison temporarily unavailable." }),
        }), { times: 1 });
        await conflict(loser).getByRole("button", { name: "Compare newer version" }).click();
        await expect(conflict(loser).getByText(/Comparison temporarily unavailable/)).toBeVisible();
        await expect(clinicalNotes(loser)).toHaveValue(draftNote);
      }
      await conflict(loser).getByRole("button", { name: "Compare newer version" }).click();
      await expect(conflict(loser).getByText(draftNote, { exact: true })).toBeVisible();
      await expect(conflict(loser).getByText(winningNote, { exact: true })).toBeVisible();
      await pages[loser].setViewportSize({ width: 390, height: 844 });
      assert.equal(await conflict(loser).evaluate(element => element.scrollWidth > element.clientWidth), false, "comparison values must wrap within their container");
      await pages[loser].setViewportSize({ width: 1280, height: 900 });

      if (loser === "doctor") {
        await conflict(loser).getByRole("radio", { name: "Keep my draft: Notes", exact: true }).check();
      }
      await conflict(loser).getByRole("button", { name: "Apply reviewed values to editor" }).click();
      await expect(conflict(loser)).toHaveCount(0);
      await expect(clinicalNotes(loser)).toHaveValue(loser === "doctor" ? draftNote : winningNote);
      if (loser === "admin") await clinicalNotes(loser).fill(draftNote);
      await saveButton(loser).click();
      await expect(pages[loser].getByText("Editing Prescription", { exact: true })).toHaveCount(0);
      const after = await readCurrent();
      assert.equal(after.notes, draftNote);
      assert.equal(after.version, before.version + 2);
    }
    console.log("prescription conflict UI tests passed (both staff roles, preserved drafts, compare, reload failure/retry, review and save)");
  } finally {
    await browser.close();
  }
}
