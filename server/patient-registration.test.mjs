import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { chromium, expect } from "@playwright/test";

const base = process.env.TEST_BASE_URL || "http://127.0.0.1:5000";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname)) throw new Error("Use a local test service only.");
const db = new Pool({ connectionString: process.env.DATABASE_URL });
const run = `REGISTER-${randomUUID().slice(0, 8)}`;
let browser;
async function api(path, cookie, method = "GET", body, status = 200) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  assert.equal(response.status, status, `${method} ${path}: ${data.error || ""}`);
  return { ...data, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}

try {
  const admin = (await api("/api/auth/login", null, "POST", {
    role: "admin", identifier: "admin1", password: process.env.STAFF_ADMIN_PASSWORD,
  })).cookie;
  const legacyInput = {
    name: `${run} legacy`, uhid: `${run}-legacy`, treatmentStatus: "Active",
    causeOfFailure: "Historical cause", treatingNephrologist: "Historical nephrologist",
    comorbidities: "Hypertension, Type 2 Diabetes, Anaemia",
    medicalInfo: { hypertension: "140", diabetes: "126", otherComorbidities: { name: "Anaemia", value: "9.5" }, avFistula: "Yes" },
    investigations: { cbc: { hb: "9.5" }, lft: { albumin: "3.5", ast: "22" }, serumCalcium: "8.6" },
    viralStatus: { hepatitisB: "Negative", hepatitisC: "Positive", hiv: "Unknown" },
  };
  const legacy = (await api("/api/patients", admin, "POST", legacyInput, 201)).patient;
  for (const medicalInfo of [{ dryWeight: -1 }, { dryWeight: 0 }, { weightGain: -1 }, { dryWeight: "not numeric" }]) {
    await api(`/api/patients/${legacy.id}`, admin, "PATCH", { medicalInfo }, 400);
  }
  await api(`/api/patients/${legacy.id}`, null, "PATCH", { medicalInfo: { dryWeight: 52.5 } }, 401);

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  async function openAdmin(section) {
    await page.goto(base);
    await page.getByRole("button", { name: /Administrator Portal/ }).click();
    await page.getByLabel("Username", { exact: true }).fill("admin1");
    await page.getByLabel("Password", { exact: true }).fill(process.env.STAFF_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await page.getByRole("heading", { name: /Today's Dialysis Patients/ }).waitFor();
    await page.getByRole("button", { name: section, exact: true }).first().click();
  }
  const field = label => page.getByText(label, { exact: true }).locator("..").locator("input, select").first();
  await openAdmin("Register Patient");
  await expect(page.getByRole("heading", { name: "Register New Patient", exact: true })).toBeVisible();
  await expect(page.getByText("UHID", { exact: true })).toHaveCount(0);
  await expect(page.getByPlaceholder("Auto-generated if blank", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Cause of Failure", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Treating Nephrologist *", { exact: true })).toHaveCount(0);
  const numericCount = await page.locator('input[type="number"]').count();
  for (const name of ["Hypertension", "Diabetes", "Others"]) await page.getByRole("checkbox", { name, exact: true }).check();
  assert.equal(await page.locator('input[type="number"]').count(), numericCount, "checkboxes never reveal numerical inputs");
  await page.getByRole("checkbox", { name: "Diabetes", exact: true }).uncheck();
  await expect(page.getByRole("checkbox", { name: "Hypertension", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Others", exact: true })).toBeChecked();
  await expect(page.getByText("Specify Other Condition", { exact: true })).toHaveCount(0);

  const serumIds = ["register-serum-ferritin", "register-serum-calcium", "register-serum-phosphorous"];
  const lftIds = ["total-protein", "albumin", "total-bilirubin", "direct-bilirubin", "ast", "alt", "alp"].map(id => `register-lft-${id}`);
  for (const width of [1440, 820, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByLabel("Dry Weight (kg)", { exact: true }).scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `registration has no horizontal overflow at ${width}px`);
    for (const id of [...serumIds, ...lftIds, "register-dry-weight", "register-weight-gain"]) {
      const box = await page.locator(`#${id}`).boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1, `${id} fits at ${width}px`);
    }
    if (width === 1440) {
      for (const ids of [serumIds, lftIds, ["register-dry-weight", "register-weight-gain"]]) {
        const boxes = await Promise.all(ids.map(id => page.locator(`#${id}`).boundingBox()));
        assert.ok(boxes.every(box => Math.abs(box.y - boxes[0].y) <= 2), "desktop inputs align in one row");
      }
    }
  }
  await page.screenshot({ path: "/tmp/admin-registration-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await field("Full Name *").fill(`${run} new`);
  await field("Age *").fill("47");
  await field("Gender *").selectOption("Female");
  await field("Mobile Number *").fill("9000000000");
  await field("Address *").fill("Synthetic test address");
  await field("Registration Date *").fill(new Date().toISOString().slice(0, 10));
  await field("Patient Status *").selectOption("Active");
  await page.getByPlaceholder("e.g. Chronic Kidney Disease Stage 5").fill("Synthetic kidney disease");
  await field("AVF").fill("1");
  await page.locator("label").filter({ hasText: "Dialysis Days Per Week" }).locator("..").getByRole("button").first().click();
  await page.getByRole("button", { name: "Monday", exact: true }).click();
  await page.getByRole("button", { name: "OPD", exact: true }).click();
  await page.getByLabel("Dry Weight (kg)", { exact: true }).fill("-1");
  await page.getByLabel("Weight Gain (kg)", { exact: true }).fill("-1");
  await page.getByRole("button", { name: "Register Patient", exact: true }).last().click();
  await expect(page.getByText("Dry weight must be a number greater than 0 kg.", { exact: true })).toBeVisible();
  await expect(page.getByText("Weight gain must be a number of at least 0 kg.", { exact: true })).toBeVisible();
  await page.getByLabel("Dry Weight (kg)", { exact: true }).fill("52.5");
  await page.getByLabel("Weight Gain (kg)", { exact: true }).fill("2.5");
  for (const [index, id] of serumIds.entries()) await page.locator(`#${id}`).fill(String(index + 8.5));
  for (const [index, id] of lftIds.entries()) await page.locator(`#${id}`).fill(String(index + 1.5));
  await page.locator("#register-viral-hcv").selectOption("Positive");
  await page.locator("#register-viral-hiv").selectOption("Unknown");
  await page.screenshot({ path: "/tmp/admin-registration-desktop.png", fullPage: true });
  const createdResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/api/patients" && response.request().method() === "POST");
  await page.getByRole("button", { name: "Register Patient", exact: true }).last().click();
  const response = await createdResponse;
  assert.equal(response.status(), 201);
  const created = (await response.json()).patient;
  assert.match(created.uhid, /^KMCRI-\d+$/, "registration retains the automatic identifier used by existing records and lookups");
  await expect(page.getByRole("heading", { name: "Patient Registered", exact: true })).toBeVisible();
  let persisted = (await api(`/api/patients/${created.id}`, admin)).patient;
  assert.equal(persisted.medicalInfo.dryWeight, 52.5);
  assert.equal(persisted.medicalInfo.weightGain, 2.5);
  assert.deepEqual(persisted.medicalInfo.comorbidityFlags, { hypertension: true, diabetes: false, others: true });
  assert.equal(persisted.comorbidities, "Hypertension, Others");
  assert.equal(persisted.causeOfFailure, undefined);
  assert.equal(persisted.treatingNephrologist, undefined);
  assert.deepEqual(persisted.viralStatus, { hepatitisB: "Negative", hepatitisC: "Positive", hiv: "Unknown", other: "" });
  assert.deepEqual([persisted.investigations.serumFerritin, persisted.investigations.serumCalcium, persisted.investigations.serumPhosphorous], ["8.5", "9.5", "10.5"]);
  assert.deepEqual(persisted.investigations.lft, {
    totalProtein: "1.5", albumin: "2.5", totalBilirubin: "3.5", directBilirubin: "4.5", ast: "5.5", alt: "6.5", alp: "7.5",
  });
  const storedMedical = (await db.query("SELECT data->'medicalInfo' medical FROM patients WHERE id=$1", [created.id])).rows[0].medical;
  assert.deepEqual(storedMedical, persisted.medicalInfo, "weights and checkbox choices are stored in PostgreSQL");
  await page.getByRole("button", { name: "Register Another Patient", exact: true }).click();
  await expect(page.getByLabel("Dry Weight (kg)", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Weight Gain (kg)", { exact: true })).toHaveValue("");
  await expect(page.getByRole("checkbox", { name: "Hypertension", exact: true })).not.toBeChecked();

  async function openEditor(patient) {
    await page.getByPlaceholder("Search by patient name or UHID…").fill(patient.uhid);
    await page.getByRole("button").filter({ has: page.getByText(patient.name, { exact: true }) }).first().click();
    await page.getByRole("button", { name: "Edit Clinical Information", exact: true }).click();
    return page.getByRole("dialog", { name: "Edit Clinical Information" });
  }
  await openAdmin("Treatment Status");
  let editor = await openEditor(created);
  await expect(editor.getByLabel("Dry Weight (kg)", { exact: true })).toHaveValue("52.5");
  await expect(editor.getByLabel("Weight Gain (kg)", { exact: true })).toHaveValue("2.5");
  await expect(editor.getByRole("checkbox", { name: "Hypertension", exact: true })).toBeChecked();
  await expect(editor.getByRole("checkbox", { name: "Diabetes", exact: true })).not.toBeChecked();
  await expect(editor.getByRole("checkbox", { name: "Others", exact: true })).toBeChecked();
  await editor.getByRole("checkbox", { name: "Hypertension", exact: true }).uncheck();
  await editor.getByRole("checkbox", { name: "Diabetes", exact: true }).check();
  await editor.getByRole("checkbox", { name: "Others", exact: true }).uncheck();
  await editor.getByLabel("Dry Weight (kg)", { exact: true }).fill("53.75");
  await editor.getByLabel("Weight Gain (kg)", { exact: true }).fill("0");
  await editor.getByRole("button", { name: "Save Clinical Information", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.getByText("53.75 kg", { exact: true })).toBeVisible();
  await expect(page.getByText("0 kg", { exact: true })).toBeVisible();
  await openAdmin("Treatment Status");
  editor = await openEditor(created);
  await expect(editor.getByLabel("Dry Weight (kg)", { exact: true })).toHaveValue("53.75");
  await expect(editor.getByLabel("Weight Gain (kg)", { exact: true })).toHaveValue("0");
  await expect(editor.getByRole("checkbox", { name: "Hypertension", exact: true })).not.toBeChecked();
  await expect(editor.getByRole("checkbox", { name: "Diabetes", exact: true })).toBeChecked();
  await expect(editor.getByRole("checkbox", { name: "Others", exact: true })).not.toBeChecked();
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();

  await openAdmin("Treatment Status");
  editor = await openEditor(legacy);
  for (const name of ["Hypertension", "Diabetes", "Others"]) await expect(editor.getByRole("checkbox", { name, exact: true })).toBeChecked();
  await editor.getByRole("checkbox", { name: "Hypertension", exact: true }).uncheck();
  await editor.getByLabel("Dry Weight (kg)", { exact: true }).fill("50.25");
  await editor.getByRole("button", { name: "Save Clinical Information", exact: true }).click();
  await expect(editor).toHaveCount(0);
  persisted = (await api(`/api/patients/${legacy.id}`, admin)).patient;
  assert.equal(persisted.causeOfFailure, legacyInput.causeOfFailure);
  assert.equal(persisted.treatingNephrologist, legacyInput.treatingNephrologist);
  assert.deepEqual(persisted.investigations, legacyInput.investigations);
  assert.equal(persisted.medicalInfo.hypertension, "140", "older readings are not deleted by checkbox editing");
  assert.deepEqual(persisted.medicalInfo.otherComorbidities, legacyInput.medicalInfo.otherComorbidities);
  assert.equal(persisted.medicalInfo.comorbidityFlags.hypertension, false);
  assert.ok(persisted.comorbidities.includes("Anaemia"), "named historical comorbidities remain intact");
  assert.equal(persisted.comorbidities, "Type 2 Diabetes, Anaemia", "checkbox editing does not duplicate named historical conditions");
  assert.deepEqual(errors, [], "registration and clinical editing have no browser runtime errors");
  console.log("patient registration tests passed: real database persistence, decimal weights, checkboxes, preserved historical data, label mappings, desktop/tablet/mobile layout, and editing after refresh");
} finally {
  if (browser) await browser.close();
  const ids = (await db.query("SELECT id FROM patients WHERE data->>'name' LIKE $1", [`${run}%`])).rows.map(row => row.id);
  await db.query("DELETE FROM notifications WHERE patient_id=ANY($1::text[])", [ids]);
  await db.query("DELETE FROM audit_logs WHERE entity_id=ANY($1::text[])", [ids]);
  await db.query("DELETE FROM patients WHERE id=ANY($1::text[])", [ids]);
  await db.end();
}
