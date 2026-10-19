import assert from "node:assert/strict";
import { expect } from "@playwright/test";

// Reuses the note-conflict suite's signed-in page and synthetic patient only.
export async function verifyClinicalNoteDraftWarnings({ page, patient, noteId, readNote, request, admin, run }) {
  const dialogs = [];
  let acceptNext = false;
  page.on("dialog", async dialog => {
    dialogs.push({ type: dialog.type(), message: dialog.message() });
    const accept = acceptNext;
    acceptNext = false;
    if (accept) await dialog.accept(); else await dialog.dismiss();
  });
  async function prompted(action, { accept = false, type = "confirm" } = {}) {
    const count = dialogs.length;
    acceptNext = accept;
    await action();
    await expect.poll(() => dialogs.length).toBe(count + 1);
    assert.equal(dialogs.at(-1).type, type);
    if (type === "confirm") assert.match(dialogs.at(-1).message, /unsaved clinical note changes/);
  }
  const blockedUnload = () => page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  const body = () => page.getByPlaceholder("Enter detailed clinical observations, treatment notes, and patient status...");
  const title = () => page.getByPlaceholder("Enter note title...");
  const weight = () => page.locator("form").getByPlaceholder("e.g., Stable");
  const save = () => page.getByRole("button", { name: "Save Note", exact: true });
  const cancel = () => page.getByRole("button", { name: "Cancel", exact: true });
  const add = () => page.getByRole("button", { name: "Add Note", exact: true });
  const home = () => page.getByRole("button", { name: "Home", exact: true });
  const notes = () => page.getByRole("button", { name: "Notes", exact: true });
  const conflict = () => page.getByRole("region", { name: "Clinical note conflict" });
  async function edit(noteTitle) {
    await page.getByRole("heading", { name: noteTitle, exact: true }).locator("../../..").getByTitle("Edit clinical note").click();
    await expect(page.getByRole("heading", { name: "Edit Clinical Note", exact: true })).toBeVisible();
  }
  async function selectPatient() {
    await page.getByText("Select Patient", { exact: true }).click();
    await page.getByRole("button", { name: patient.name }).click();
  }

  const initial = await readNote();
  await edit(initial.data.title);
  assert.equal(await blockedUnload(), false, "unchanged clinical edits do not warn");
  await weight().fill("123");
  assert.equal(await blockedUnload(), true, "vital-sign-only changes count as unsaved");
  await weight().fill(initial.data.vitals.weight);
  const type = page.locator("form select");
  const originalType = await type.inputValue();
  await type.selectOption(originalType === "assessment" ? "session" : "assessment");
  assert.equal(await blockedUnload(), true);
  await type.selectOption(originalType);
  assert.equal(await blockedUnload(), false, "reverted fields return to a clean state");
  const cleanCount = dialogs.length;
  await cancel().click();
  await expect(body()).toHaveCount(0);
  assert.equal(dialogs.length, cleanCount);
  await add().click();
  assert.equal(await blockedUnload(), false, "a blank new-note form is clean");
  await selectPatient();
  assert.equal(await blockedUnload(), true, "patient selection belongs to a new note's draft");
  await page.getByTitle("Clear selection").click();
  assert.equal(await blockedUnload(), false, "clearing the patient restores the blank baseline");
  await title().fill(`${run} temporary new note`);
  await body().fill(`${run} temporary unsaved content`);
  await prompted(() => cancel().click());
  await prompted(() => add().click());
  await expect(title()).toHaveValue(`${run} temporary new note`);
  await prompted(() => add().click(), { accept: true });
  await expect(title()).toHaveValue("");
  assert.equal(await blockedUnload(), false, "confirmed replacement starts a fresh baseline");
  await selectPatient();
  const createdTitle = `${run} created draft test`;
  await title().fill(createdTitle);
  await body().fill(`${run} created body`);

  // Pending creation blocks navigation and disabling local controls prevents
  // cancelling a request that may already have committed.
  let release, started;
  const wait = new Promise(resolve => { release = resolve; });
  const pending = new Promise(resolve => { started = resolve; });
  const creation = page.waitForResponse(response =>
    new URL(response.url()).pathname === "/api/clinical-notes" && response.request().method() === "POST");
  await page.route("**/api/clinical-notes", async route => {
    if (route.request().method() !== "POST") return route.continue();
    started(); await wait; await route.continue();
  }, { times: 1 });
  await save().click();
  await pending;
  try {
    await expect(add()).toBeDisabled();
    await expect(cancel()).toBeDisabled();
    await prompted(() => home().click(), { type: "alert", accept: true });
    assert.equal(await blockedUnload(), true);
    await expect(body()).toHaveValue(`${run} created body`);
  } finally { release(); }
  const created = (await (await creation).json()).note;
  await expect(body()).toHaveCount(0);
  assert.equal(await blockedUnload(), false, "successful creation clears the warning");
  const savedCount = dialogs.length;
  await home().click(); await notes().click();
  assert.equal(dialogs.length, savedCount);
  await edit(createdTitle);
  await body().fill(`${run} failed edit draft`);
  await page.route(`**/api/clinical-notes/${created.id}`, route => route.fulfill({
    status: 503, contentType: "application/json", body: JSON.stringify({ error: "Clinical note draft save failed." }),
  }), { times: 1 });
  await save().click();
  await expect(page.getByText("Clinical note draft save failed.", { exact: true })).toBeVisible();
  await prompted(() => home().click());
  await expect(body()).toHaveValue(`${run} failed edit draft`);
  await prompted(() => edit(initial.data.title));
  await expect(body()).toHaveValue(`${run} failed edit draft`);
  await prompted(() => edit(initial.data.title), { accept: true });
  await expect(body()).toHaveValue(initial.body);
  assert.equal(await blockedUnload(), false, "switching notes starts with the selected note's values");

  const draftBody = `${run} navigation draft`;
  await body().fill(draftBody);
  await title().fill(`${run} navigation title`);
  await weight().fill("77");
  const sameSectionCount = dialogs.length;
  await notes().click();
  assert.equal(dialogs.length, sameSectionCount);
  await prompted(() => home().click());
  await prompted(() => page.evaluate(() => {
    window.setTimeout(() => window.location.reload(), 0);
  }), { type: "beforeunload" });
  await expect(body()).toHaveValue(draftBody);
  await expect(weight()).toHaveValue("77");
  await prompted(() => page.getByRole("button", { name: "Logout", exact: true }).click());
  await expect(title()).toHaveValue(`${run} navigation title`);

  // Neither background refresh nor comparison failures may silently mark a
  // clinical draft clean or advance its captured revision.
  await request(`/api/clinical-notes/${noteId}`, admin, "PATCH", {
    baseVersion: initial.version, body: `${run} newer background note`,
  });
  const latest = await readNote();
  const refresh = page.waitForResponse(response => new URL(response.url()).pathname === `/api/patients/${patient.id}/clinical-notes`);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await refresh;
  await expect(body()).toHaveValue(draftBody);
  await save().click();
  await expect(conflict()).toBeVisible();
  await prompted(() => home().click());
  await expect(conflict()).toBeVisible();
  await page.route(`**/api/patients/${patient.id}/clinical-notes`, route => route.fulfill({
    status: 503, contentType: "application/json", body: JSON.stringify({ error: "Draft review unavailable." }),
  }), { times: 1 });
  await conflict().getByRole("button", { name: "Compare newer note", exact: true }).click();
  await expect(conflict().getByRole("alert")).toHaveText("Draft review unavailable.");
  await prompted(() => cancel().click());
  await expect(conflict().getByRole("alert")).toHaveText("Draft review unavailable.");
  await conflict().getByRole("button", { name: "Compare newer note", exact: true }).click();
  const keepDraft = conflict().getByRole("radio", { name: "Keep my draft: Clinical notes", exact: true });
  await keepDraft.check();
  await prompted(() => home().click());
  await expect(keepDraft).toBeChecked();
  await expect(body()).toHaveValue(draftBody);
  await conflict().getByRole("button", { name: "Apply reviewed values to editor", exact: true }).click();
  assert.equal(await blockedUnload(), true, "applying reviewed draft values is not a save");
  await prompted(() => home().click());
  await body().fill(latest.body);
  assert.equal(await blockedUnload(), false, "explicitly reviewed saved values are a clean baseline");
  await body().fill(draftBody);
  await prompted(() => home().click(), { accept: true });
  assert.deepEqual(await readNote(), latest, "confirmed discard never writes a note");
  await notes().click();
  await edit(latest.data.title);
  await body().fill(`${run} logout draft`);
  await prompted(() => page.getByRole("button", { name: "Logout", exact: true }).click(), { accept: true });
  await expect(page.getByRole("button", { name: "Login to Portal", exact: true })).toBeVisible();
  assert.equal(await blockedUnload(), false, "unmounting the note editor clears the staff guard");
  assert.deepEqual(await readNote(), latest);
  console.log("clinical note draft warning tests passed (new/edit, patient/type/vitals, clean/reverted/saved, cancel/switch, navigation/reload/logout, failed/pending saves, conflict review)");
}
