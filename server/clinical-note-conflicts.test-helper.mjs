import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";

// Runs inside staff-gaps.test.mjs using only its synthetic records and cleanup.
export async function verifyClinicalNoteConflicts({ base, db, admin, author, otherDoctor, patient, noteId, email, password, run }) {
  const path = `/api/clinical-notes/${noteId}`;
  async function request(url, cookie, method = "GET", body, status = 200) {
    const response = await fetch(`${base}${url}`, {
      method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const result = await response.json();
    assert.equal(response.status, status, result.error);
    return result;
  }
  const current = async () => (await request("/api/clinical-notes", author)).notes.find(note => note.id === noteId);
  const effects = async () => (await db.query(`SELECT
    (SELECT count(*)::int FROM audit_logs WHERE entity_id=$1) audits,
    (SELECT count(*)::int FROM notifications WHERE record_id=$1) notifications`, [noteId])).rows[0];
  const original = await current();
  const before = await effects();
  for (const baseVersion of [undefined, null, 0, -1, 1.1, "1", true, 9007199254740992]) {
    await request(path, author, "PATCH", { baseVersion, body: "Invalid" }, 400);
  }
  await request(path, undefined, "PATCH", { baseVersion: original.version, body: "Unauthorized" }, 401);
  await request(path, otherDoctor, "PATCH", { baseVersion: original.version, body: "Not mine" }, 403);
  assert.deepEqual(await current(), original);
  assert.deepEqual(await effects(), before, "rejected requests have no audit or notification side effects");

  for (const [winner, stale] of [[admin, author], [author, admin]]) {
    const start = await current();
    await request(path, winner, "PATCH", { baseVersion: start.version, body: `${run} winner`,
      data: { title: `${run} conflict note`, vitals: { weight: "62", bloodPressure: "120/80" } } });
    const winning = await current(), winningEffects = await effects();
    const conflict = await request(path, stale, "PATCH", { baseVersion: start.version, body: "Stale",
      data: { title: "Stale title", vitals: { weight: "99" } } }, 409);
    assert.equal(conflict.code, "CLINICAL_NOTE_VERSION_CONFLICT");
    assert.equal(conflict.currentVersion, start.version + 1);
    assert.deepEqual(await current(), winning, "stale content, metadata, vitals and timestamps must remain untouched");
    assert.deepEqual(await effects(), winningEffects, "conflicts emit no audit or notification");
  }

  const simultaneousBase = await current();
  const concurrent = await Promise.all([admin, author].map((cookie, index) => fetch(`${base}${path}`, {
    method: "PATCH", headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ baseVersion: simultaneousBase.version, body: `${run} simultaneous ${index}` }),
  })));
  assert.deepEqual(concurrent.map(response => response.status).sort(), [200, 409], "only one simultaneous writer may win");
  assert.equal((await current()).version, simultaneousBase.version + 1);
  const patientNotes = await request(`/api/patients/${patient.id}/clinical-notes`, author);
  assert.equal(patientNotes.notes.find(note => note.id === noteId).version, simultaneousBase.version + 1);

  const browser = await chromium.launch({ headless: true });
  const errors = [];
  try {
    const pages = [];
    const initial = await current();
    for (let i = 0; i < 2; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(base);
      await page.getByRole("button", { name: "Doctor Portal" }).click();
      await page.locator('input[name="email"]').fill(email);
      await page.locator('input[name="password"]').fill(password);
      await page.getByRole("button", { name: "Login to Portal", exact: true }).click();
      await page.getByRole("button", { name: "Notes", exact: true }).click();
      await page.getByRole("heading", { name: initial.data.title, exact: true }).locator("../../..").getByTitle("Edit clinical note").click();
      pages.push(page);
    }
    const [winner, loser] = pages;
    const body = page => page.getByPlaceholder("Enter detailed clinical observations, treatment notes, and patient status...");
    const title = page => page.getByPlaceholder("Enter note title...");
    const weight = page => page.locator("form").getByPlaceholder("e.g., Stable");
    const save = page => page.getByRole("button", { name: "Save Note", exact: true });
    const conflict = () => loser.getByRole("region", { name: "Clinical note conflict" });
    const draftBody = `${run} preserved draft ${"long-clinical-value".repeat(15)}`;
    await title(winner).fill(`${run} latest title`);
    await body(winner).fill(`${run} latest body`);
    await weight(winner).fill("63");
    await title(loser).fill(`${run} draft title`);
    await body(loser).fill(draftBody);
    await weight(loser).fill("64");
    await loser.evaluate(() => {
      window.noteSaveEvents = 0;
      window.addEventListener("staff-data-changed", () => window.noteSaveEvents++);
    });
    await save(winner).click();
    await expect(winner.getByRole("heading", { name: `${run} latest title`, exact: true })).toBeVisible();
    const refresh = loser.waitForResponse(response => new URL(response.url()).pathname === `/api/patients/${patient.id}/clinical-notes`);
    await loser.bringToFront();
    await loser.evaluate(() => window.dispatchEvent(new Event("focus")));
    await refresh;
    await expect(body(loser)).toHaveValue(draftBody);
    const preConflict = await current(), preConflictEffects = await effects();
    await save(loser).click();
    await expect(conflict()).toBeVisible();
    await expect(save(loser)).toBeDisabled();
    await expect(title(loser)).toHaveValue(`${run} draft title`);
    await expect(body(loser)).toHaveValue(draftBody);
    await expect(weight(loser)).toHaveValue("64");
    assert.deepEqual(await current(), preConflict);
    assert.deepEqual(await effects(), preConflictEffects);
    assert.equal(await loser.evaluate(() => window.noteSaveEvents), 0, "a failed save cannot announce success");

    await loser.route(`**/api/patients/${patient.id}/clinical-notes`, route => route.fulfill({
      status: 503, contentType: "application/json", body: JSON.stringify({ error: "Note comparison unavailable." }),
    }), { times: 1 });
    await conflict().getByRole("button", { name: "Compare newer note", exact: true }).click();
    await expect(conflict().getByRole("alert")).toHaveText("Note comparison unavailable.");
    await expect(body(loser)).toHaveValue(draftBody);
    await conflict().getByRole("button", { name: "Compare newer note", exact: true }).click();
    await expect(conflict().getByText(`${run} latest body`, { exact: true })).toBeVisible();
    await loser.setViewportSize({ width: 390, height: 844 });
    assert.equal(await conflict().evaluate(element => element.scrollWidth > element.clientWidth), false);
    await loser.setViewportSize({ width: 1280, height: 900 });
    await conflict().getByRole("radio", { name: "Keep my draft: Clinical notes", exact: true }).check();
    await conflict().getByRole("radio", { name: "Keep my draft: Title", exact: true }).check();
    await conflict().getByRole("button", { name: "Apply reviewed values to editor", exact: true }).click();
    await expect(body(loser)).toHaveValue(draftBody);
    await expect(weight(loser)).toHaveValue("63");
    assert.deepEqual(await current(), preConflict, "reviewing values does not auto-save");

    // Another edit after review must require another explicit comparison.
    await request(path, admin, "PATCH", { baseVersion: preConflict.version, body: `${run} changed again` });
    await save(loser).click();
    await expect(conflict()).toBeVisible();
    await expect(body(loser)).toHaveValue(draftBody);
    await conflict().getByRole("button", { name: "Compare newer note", exact: true }).click();
    await expect(conflict().getByText(`${run} changed again`, { exact: true })).toBeVisible();
    await conflict().getByRole("radio", { name: "Keep my draft: Clinical notes", exact: true }).check();
    await conflict().getByRole("button", { name: "Apply reviewed values to editor", exact: true }).click();
    await save(loser).click();
    await expect(loser.getByRole("heading", { name: "Edit Clinical Note", exact: true })).toHaveCount(0);
    const saved = await current();
    assert.equal(saved.body, draftBody);
    assert.equal(saved.data.vitals.weight, "63");
    assert.equal(saved.version, preConflict.version + 2);
    assert.equal(saved.author_id, original.author_id, "administrator edits never change authorship");
    const audit = (await db.query("SELECT metadata FROM audit_logs WHERE entity_id=$1 AND action='note.update' ORDER BY created_at DESC LIMIT 1", [noteId])).rows[0].metadata;
    assert.equal(audit.before.version, saved.version - 1);
    assert.equal(audit.after.version, saved.version);
    assert.deepEqual(errors, [], "note conflict workflows have no runtime errors");
    console.log("clinical note conflict tests passed (both writer roles, races, validation, side effects, preserved drafts, refresh, failed comparison/retry, review and save)");
  } finally { await browser.close(); }
}
