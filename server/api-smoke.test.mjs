/*
 * Development integration smoke test.
 *
 * Start the app first, then run:
 *   node server/api-smoke.test.mjs
 *
 * It uses configured staff secrets internally but never prints them and makes
 * no persistent data changes.
 */
import assert from "node:assert/strict";

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:5000";

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

async function login(role, identifier, password) {
  assert.ok(password, `Missing configured ${role} staff password.`);
  const response = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ role, identifier, password }),
  });
  assert.equal(response.status, 200, `${role} login should succeed.`);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie, `${role} login should return a session cookie.`);
  return cookie;
}

const unauthenticated = await request("/api/patients");
assert.equal(unauthenticated.status, 401, "Patient data must require staff authentication.");

const adminCookie = await login("admin", "admin1", process.env.STAFF_ADMIN_PASSWORD);
for (const path of [
  "/api/auth/me",
  "/api/patients",
  "/api/units",
  "/api/machines",
  "/api/sessions",
  "/api/prescriptions",
  "/api/notifications",
  "/api/analytics",
  "/api/audit-logs",
]) {
  const response = await request(path, { headers: { Cookie: adminCookie } });
  assert.equal(response.status, 200, `Administrator should access ${path}.`);
}

const doctorCookie = await login("doctor", "doctor1", process.env.STAFF_DOCTOR_PASSWORD);
const doctorPatientList = await request("/api/patients", { headers: { Cookie: doctorCookie } });
assert.equal(doctorPatientList.status, 200, "Doctor should be able to review patients.");

const rejectedAdminWrite = await request("/api/patients", {
  method: "POST",
  headers: { Cookie: doctorCookie },
  body: JSON.stringify({ uhid: "UNUSED-SMOKE", name: "Not written" }),
});
assert.equal(rejectedAdminWrite.status, 403, "Doctor must not create administrator-only patient records.");

console.log("API smoke tests passed: authentication, staff access, and administrator-only writes are protected.");