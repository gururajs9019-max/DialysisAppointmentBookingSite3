import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";

// Uses only the concurrency suite's synthetic patients and prescriptions.
export async function runPrescriptionDraftUiTest({ baseUrl, patient, blankPatient, prescriptionId }) {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const role of ["admin", "doctor"]) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors = [], dialogs = [];
      let acceptNext = false;
      page.on("pageerror", error => errors.push(error.message));
      page.on("dialog", async dialog => {
        dialogs.push({ type: dialog.type(), message: dialog.message() });
        const accept = acceptNext;
        acceptNext = false;
        if (accept) await dialog.accept(); else await dialog.dismiss();
      });
      const prompted = async (action, { accept = false, type = "confirm" } = {}) => {
        const before = dialogs.length;
        acceptNext = accept;
        await action();
        await expect.poll(() => dialogs.length).toBe(before + 1);
        assert.equal(dialogs.at(-1).type, type);
        if (type === "confirm") assert.match(dialogs.at(-1).message, /unsaved prescription changes/);
      };
      const blockedUnload = () => page.evaluate(() => {
        const event = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      });
      const section = () => page.getByRole("button", { name: role === "admin" ? "Treatment Status" : "Prescriptions", exact: true });
      const away = () => page.getByRole("button", { name: role === "admin" ? "Patient History" : "Home", exact: true });
      const search = () => page.getByPlaceholder("Search by patient name or UHID…");
      const notes = () => page.locator("textarea");
      const save = () => page.getByRole("button", { name: role === "admin" ? "Save Prescription" : "Save Changes", exact: true });
      const cancel = () => page.getByRole("button", { name: "Cancel", exact: true });
      const editing = () => page.getByText("Editing Prescription", { exact: true });
      async function patientAction(target, name = "Edit Prescription") {
        await search().fill(target.uhid);
        const action = page.getByRole("button", { name, exact: true }).first();
        if (!(await action.isVisible())) await page.getByRole("button").filter({ hasText: target.name }).first().click();
        return action;
      }
      async function edit() {
        await (await patientAction(patient)).click();
        await expect(editing()).toBeVisible();
      }
      const current = () => page.evaluate(async id => {
        const response = await fetch("/api/prescriptions");
        assertResponse(response);
        return (await response.json()).prescriptions.find(row => row.id === id);
        function assertResponse(response) { if (!response.ok) throw new Error("Could not read prescription."); }
      }, prescriptionId);

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
      await section().click();
      await edit();
      const baseline = await current();
      const beforeClean = dialogs.length;
      assert.equal(await blockedUnload(), false, "opening an unchanged draft does not warn");
      await cancel().click();
      await expect(editing()).toHaveCount(0);
      assert.equal(dialogs.length, beforeClean, "unchanged cancellation needs no confirmation");

      await edit();
      const draftNote = `${patient.uhid} ${role} unsaved draft`;
      await notes().fill(draftNote);
      assert.equal(await blockedUnload(), true);
      await section().click();
      assert.equal(dialogs.length, beforeClean, "same-section navigation does not discard or warn");
      await prompted(() => away().click());
      await expect(notes()).toHaveValue(draftNote);
      await prompted(() => cancel().click());
      await expect(notes()).toHaveValue(draftNote);
      // A cancelled reload has no navigation to await.
      await prompted(() => page.evaluate(() => {
        window.setTimeout(() => window.location.reload(), 0);
      }), { type: "beforeunload" });
      await expect(notes()).toHaveValue(draftNote);
      await notes().fill(baseline.notes);
      assert.equal(await blockedUnload(), false, "reverting all changes clears dirty state");
      await notes().fill(draftNote);

      const refreshed = page.waitForResponse(response => new URL(response.url()).pathname === "/api/prescriptions");
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await refreshed;
      await expect(notes()).toHaveValue(draftNote);
      assert.equal(await blockedUnload(), true, "background refresh cannot clear the draft warning");
      await prompted(() => cancel().click(), { accept: true });
      await expect(editing()).toHaveCount(0);
      assert.equal((await current()).version, baseline.version, "discarding cannot write a prescription");

      await edit();
      await notes().fill(draftNote);
      await prompted(() => away().click(), { accept: true });
      await expect(editing()).toHaveCount(0);
      await section().click();
      await edit();
      await expect(notes()).toHaveValue(baseline.notes);
      await notes().fill(draftNote);
      await page.route(`**/api/prescriptions/${prescriptionId}`, route => route.fulfill({
        status: 503, contentType: "application/json", body: JSON.stringify({ error: "Draft test save failed." }),
      }), { times: 1 });
      await save().click();
      await expect(page.getByText("Draft test save failed.", { exact: true }).first()).toBeVisible();
      await prompted(() => away().click());
      await expect(notes()).toHaveValue(draftNote);

      let release, started;
      const pending = new Promise(resolve => { started = resolve; });
      const wait = new Promise(resolve => { release = resolve; });
      await page.route(`**/api/prescriptions/${prescriptionId}`, async route => {
        started();
        await wait;
        await route.continue();
      }, { times: 1 });
      await save().click();
      await pending;
      try {
        await prompted(() => away().click(), { type: "alert", accept: true });
        await expect(notes()).toHaveValue(draftNote);
        assert.equal(await blockedUnload(), true, "in-flight saves also protect browser navigation");
      } finally { release(); }
      await expect(editing()).toHaveCount(0);
      assert.equal((await current()).notes, draftNote);
      assert.equal(await blockedUnload(), false, "successful save clears the warning");
      const afterSave = dialogs.length;
      await away().click();
      await section().click();
      assert.equal(dialogs.length, afterSave, "saved drafts do not warn on navigation");

      // Switching to another patient's edit/create must not silently replace a draft.
      await edit();
      await notes().fill(`${draftNote} replacement`);
      const actionName = role === "admin" ? "Create Prescription" : "Edit Prescription";
      await prompted(async () => (await patientAction(blankPatient, actionName)).click());
      await search().fill(patient.uhid);
      if (!(await notes().isVisible())) await page.getByRole("button").filter({ hasText: patient.name }).first().click();
      await expect(notes()).toHaveValue(`${draftNote} replacement`);
      await prompted(async () => (await patientAction(blankPatient, actionName)).click(), { accept: true });
      assert.equal(await blockedUnload(), false, "a replacement editor starts with a clean baseline");
      if (role === "admin") {
        await notes().fill("New prescription draft");
        await prompted(() => away().click());
        await expect(notes()).toHaveValue("New prescription draft");
        await page.getByRole("button", { name: "Create Prescription", exact: true }).click();
        await expect(notes()).toHaveCount(0);
        assert.equal(await blockedUnload(), false, "creating a prescription clears its draft guard");
      } else {
        await cancel().click();
      }
      assert.equal((await current()).notes, draftNote, "switching drafts must not save the discarded values");

      await edit();
      await notes().fill(`${draftNote} logout`);
      await prompted(() => page.getByRole("button", { name: "Logout", exact: true }).click());
      await expect(notes()).toHaveValue(`${draftNote} logout`);
      await prompted(() => page.getByRole("button", { name: "Logout", exact: true }).click(), { accept: true });
      await expect(page.getByRole("button", { name: role === "admin" ? "Sign In" : "Login to Portal", exact: true })).toBeVisible();
      assert.equal(await blockedUnload(), false, "logout removes the active draft guard");
      assert.deepEqual(errors, [], "staff draft handling has no runtime errors");
      await context.close();
    }
    console.log("prescription draft UI tests passed (both roles, clean/reverted/saved drafts, cancel, navigation, switching, creation, reload, logout, refresh, failed/pending saves)");
  } finally { await browser.close(); }
}
