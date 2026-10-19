import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transformWithEsbuild } from "vite";

// Execute the real staff client without a browser or database.
const source = await readFile(new URL("../src/app/lib/staffApi.ts", import.meta.url), "utf8");
const { code } = await transformWithEsbuild(source, "staffApi.ts", { loader: "ts" });
const api = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
globalThis.window = new EventTarget();

const count = 120;
const rows = Array.from({ length: count }, (_, index) => ({
  id: `rx-${index}`, patientId: `patient-${index}`, version: 3,
  notes: "version 3", updatedBy: "Doctor", updatedByRole: "doctor",
  dialysisRx: { duration: "4 Hours" }, medications: [],
}));
const histories = new Map(rows.map(row => [row.id, Array.from({ length: 3 }, (_, index) => ({
  version: index + 1, created_at: `2026-10-0${index + 1}T00:00:00Z`,
  changed_by_name: index === 0 ? "Administrator" : "Doctor",
  changed_by_role: index === 0 ? "admin" : "doctor",
  snapshot: { notes: `version ${index + 1}`, dialysisRx: { duration: `${index + 2} Hours` }, medications: [] },
}))]));
let calls = [];
let visibleRows = rows;
let failHistory = null;
let failList = null;
let holdHistory = null;
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });
function revise(id, role) {
  const row = rows.find(item => item.id === id);
  row.version++;
  row.notes = `version ${row.version}`;
  row.updatedBy = role === "admin" ? "Administrator" : "Doctor";
  row.updatedByRole = role;
  histories.get(id).push({
    version: row.version, changed_by_name: row.updatedBy, changed_by_role: role,
    snapshot: { notes: row.notes, dialysisRx: row.dialysisRx, medications: [] },
  });
}
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url, method: options.method || "GET" });
  if (url === "/api/prescriptions") {
    if (failList) { const status = failList; failList = null; return reply({ error: "Session expired." }, status); }
    return reply({ prescriptions: visibleRows });
  }
  const match = url.match(/^\/api\/prescriptions\/([^/]+)(\/history)?$/);
  if (match?.[2]) {
    const id = decodeURIComponent(match[1]);
    if (failHistory === id) { failHistory = null; return reply({ error: "History unavailable." }, 503); }
    const response = reply({ history: histories.get(id) });
    if (holdHistory?.id === id) {
      const hold = holdHistory;
      holdHistory = null;
      hold.started();
      await hold.wait;
      if (hold.fail) return reply({ error: "Older history failed." }, 503);
    }
    return response;
  }
  if (match && options.method === "PATCH") {
    const row = rows.find(row => row.id === decodeURIComponent(match[1]));
    const payload = JSON.parse(options.body);
    assert.ok(Number.isSafeInteger(payload.baseVersion), "staff client must send the draft's base version");
    assert.ok(!Object.hasOwn(payload, "version"), "base version is not clinical data");
    if (row.version !== payload.baseVersion) return reply({
      code: "PRESCRIPTION_VERSION_CONFLICT", currentVersion: row.version, error: "Newer prescription exists.",
    }, 409);
    revise(decodeURIComponent(match[1]), "admin");
    return reply({ prescription: rows.find(row => row.id === match[1]) });
  }
  const data = {
    "/api/patients": { patients: [] }, "/api/machines": { machines: [] },
    "/api/units": { units: [] }, "/api/sessions": { sessions: [] },
    "/api/notifications": { notifications: [] }, "/api/analytics": { analytics: {} },
  };
  assert.ok(data[url], `Unexpected request: ${url}`);
  return reply(data[url]);
};
const historyCalls = () => calls.filter(call => call.url.endsWith("/history"));
const resetCalls = () => { calls = []; };

const first = await api.loadStaffData();
assert.equal(calls.length, count + 7, "initial load fetches each history once plus seven staff collections");
assert.equal(historyCalls().length, count);
assert.deepEqual(first.prescriptions[0].history.map(row => row.version), [2, 1], "exclude current version and preserve comparison ordering");
assert.equal(first.prescriptions[0].history[1].updatedByRole, "admin");
assert.equal(first.prescriptions[0].history[0].updatedBy, "Doctor");
first.prescriptions[0].history[0].dialysisRx.duration = "mutated draft";
resetCalls();
const second = await api.loadStaffData();
assert.equal(calls.length, 7, "unchanged periodic refresh is constant request count for a large list");
assert.equal(historyCalls().length, 0);
assert.equal(second.prescriptions[0].history[0].dialysisRx.duration, "3 Hours", "drafts cannot mutate cached immutable snapshots");

for (const role of ["doctor", "admin"]) {
  revise("rx-42", role);
  resetCalls();
  const changed = await api.loadStaffData();
  assert.equal(calls.length, 8, "external revision reloads only its history");
  assert.deepEqual(historyCalls().map(call => call.url), ["/api/prescriptions/rx-42/history"]);
  const row = changed.prescriptions.find(row => row.id === "rx-42");
  assert.equal(row.updatedByRole, role, "latest authenticated metadata must come from the current list");
  assert.equal(row.history.length, row.version - 1);
  assert.equal(row.history.at(-1).notes, "version 1", "old snapshots survive both portal revisions");
}

let refreshFromSave;
const onSave = () => { refreshFromSave = api.fetchPrescriptions(); };
window.addEventListener("staff-data-changed", onSave);
resetCalls();
const staleDraft = structuredClone(second.prescriptions[42]);
await assert.rejects(api.updatePrescription("rx-42", staleDraft), error =>
  error instanceof api.PrescriptionConflictError && error.operation === "save" && error.currentVersion === 5);
assert.deepEqual(staleDraft, second.prescriptions[42], "conflict must not change or rebase the draft");
assert.equal(refreshFromSave, undefined, "failed save must not dispatch a success refresh");
assert.equal(calls.length, 1, "conflict must not silently reload or retry");
const reviewed = (await api.fetchPrescriptions()).find(row => row.id === "rx-42");
resetCalls();
const saved = await api.updatePrescription("rx-42", reviewed);
await refreshFromSave;
window.removeEventListener("staff-data-changed", onSave);
assert.equal(saved.version, 6, "local saves immediately reload the new version");
assert.equal(historyCalls().length, 1, "save-triggered overlapping refresh shares the invalidated history request");
assert.equal(saved.history[0].updatedByRole, "admin");
assert.equal(saved.history[1].updatedByRole, "doctor");

api.clearPrescriptionHistoryCache();
resetCalls();
await Promise.all([api.fetchPrescriptions(), api.fetchPrescriptions()]);
assert.equal(historyCalls().length, count, "concurrent cold refreshes share in-flight histories");

revise("rx-10", "doctor");
failHistory = "rx-10";
await assert.rejects(api.loadStaffData(), error => error instanceof api.StaffApiError && error.operation === "load" && error.message === "History unavailable.");
resetCalls();
await api.loadStaffData();
assert.equal(historyCalls().length, 1, "failed history is retried without refetching unchanged histories");
failList = 401;
await assert.rejects(api.fetchPrescriptions(), /Session expired/);
resetCalls();
await api.fetchPrescriptions();
assert.equal(historyCalls().length, count, "expired authorization clears all cached clinical histories");

for (const fail of [false, true]) {
  // An older completion must not overwrite or evict a newer revision's cache.
  api.clearPrescriptionHistoryCache();
  let started, release;
  const start = new Promise(resolve => { started = resolve; });
  holdHistory = { id: "rx-0", started, wait: new Promise(resolve => { release = resolve; }), fail };
  const older = api.fetchPrescriptions();
  // Attach the rejection handler before releasing a failed response.
  const olderResult = fail ? assert.rejects(older, /Older history failed/) : older;
  await start;
  revise("rx-0", "doctor");
  const newer = await api.fetchPrescriptions();
  release();
  await olderResult;
  resetCalls();
  const latest = await api.fetchPrescriptions();
  assert.equal(historyCalls().length, 0, "late old response cannot invalidate the newer cached version");
  assert.deepEqual(latest[0].history, newer[0].history);
}

visibleRows = rows.slice(1);
await api.fetchPrescriptions();
visibleRows = rows;
resetCalls();
await api.fetchPrescriptions();
assert.equal(historyCalls().length, 1, "records absent from the list are evicted");
api.clearPrescriptionHistoryCache();
resetCalls();
await api.fetchPrescriptions();
assert.equal(historyCalls().length, count, "a new staff session starts with fresh histories");

// Exercise the real synchronization effect with controllable refresh responses.
const syncSource = (await readFile(new URL("../src/app/lib/useStaffSync.ts", import.meta.url), "utf8"))
  .replace(/import \{ useEffect \} from "react";/, "const { useEffect, loadStaffData } = globalThis.staffSyncHarness;")
  .replace(/import \{ loadStaffData, type StaffData \} from "\.\/staffApi";/, "");
const syncCode = await transformWithEsbuild(syncSource, "useStaffSync.ts", { loader: "ts" });
let cleanup, timer, resolveLoad, rejectLoad;
let syncLoads = 0;
const applied = [], errors = [];
globalThis.document = { visibilityState: "visible" };
window.setInterval = callback => { timer = callback; return 0; };
globalThis.staffSyncHarness = {
  useEffect: effect => { cleanup = effect(); },
  loadStaffData: () => {
    syncLoads++;
    return new Promise((resolve, reject) => { resolveLoad = resolve; rejectLoad = reject; });
  },
};
const { useStaffSync } = await import(`data:text/javascript;base64,${Buffer.from(syncCode.code).toString("base64")}`);
const settle = () => new Promise(resolve => setImmediate(resolve));
useStaffSync(true, data => applied.push(data), error => errors.push(error));
window.dispatchEvent(new Event("focus"));
window.dispatchEvent(new Event("staff-data-changed"));
window.dispatchEvent(new Event("staff-data-changed"));
assert.equal(syncLoads, 1, "overlapping saves must not start parallel full refreshes");
resolveLoad({ version: "before save" });
await settle();
assert.equal(syncLoads, 2, "a save during a pending refresh must queue one prompt refresh");
resolveLoad({ version: "after save" });
await settle();
assert.deepEqual(applied.at(-1), { version: "after save" });
timer();
rejectLoad(new Error("Staff refresh failed."));
await settle();
assert.equal(errors.at(-1), "Staff refresh failed.", "refresh errors remain visible");
timer();
resolveLoad({ version: "recovered" });
await settle();
assert.equal(errors.at(-1), null, "a successful retry clears the error");
timer();
cleanup();
resolveLoad({ version: "disposed" });
await settle();
assert.notEqual(applied.at(-1).version, "disposed", "unmounted portal must not receive late data");
const disposedLoads = syncLoads;
window.dispatchEvent(new Event("staff-data-changed"));
assert.equal(syncLoads, disposedLoads, "unmounted portal removes refresh listeners");

console.log("staff prescription cache tests passed (120 prescriptions, revision invalidation, concurrency, isolation, errors)");
