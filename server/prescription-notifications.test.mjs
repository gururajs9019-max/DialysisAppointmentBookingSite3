import assert from "node:assert/strict";
import { randomUUID, pbkdf2Sync } from "node:crypto";
import { Pool } from "pg";
import { runPrescriptionNotificationUi } from "./prescription-notifications-ui.mjs";

const base = process.env.TEST_BASE_URL || "http://127.0.0.1:5000";
const db = new Pool({ connectionString: process.env.DATABASE_URL });
const run = `RXALERT-${randomUUID().slice(0, 8)}`;
const users = [], patients = [];
const unitId = randomUUID(), machineId = randomUUID();
let sharedReadState = [];
async function request(path, cookie, method = "GET", body, status = 200) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  assert.ok((Array.isArray(status) ? status : [status]).includes(response.status), `${method} ${path}: ${data.error || response.status}`);
  return { ...data, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
async function login(role, identifier, password) {
  return (await request("/api/auth/login", null, "POST", { role, identifier, password })).cookie;
}
async function account(role, suffix, status = "Active") {
  const id = randomUUID(), username = `${run}-${suffix}`, password = randomUUID();
  const salt = randomUUID(), hash = `${salt}:${pbkdf2Sync(password, salt, 210000, 32, "sha256").toString("hex")}`;
  await db.query(`INSERT INTO portal_users(id,username,email,name,role,password_hash,status)
    VALUES($1,$2,$3,$2,$4,$5,$6)`, [id, username, `${username}@example.test`, role, hash, status]);
  users.push(id);
  return { id, role, username, email: `${username}@example.test`, password, cookie: status === "Active" ? await login(role, username, password) : null };
}
const events = async id => (await db.query("SELECT * FROM notifications WHERE record_id=$1 ORDER BY id", [id])).rows;
try {
  sharedReadState = (await db.query("SELECT id,read FROM notifications WHERE user_id IS NULL")).rows;
  const admin = await login("admin", "admin1", process.env.STAFF_ADMIN_PASSWORD);
  const doctor = await login("doctor", "doctor1", process.env.STAFF_DOCTOR_PASSWORD);
  const primaryDoctor = (await db.query("SELECT id FROM portal_users WHERE username='doctor1'")).rows[0].id;
  const otherAdmin = await account("admin", "admin");
  const responsible = await account("doctor", "assigned");
  const unrelated = await account("doctor", "unrelated");
  const inactive = await account("doctor", "inactive", "Inactive");
  const patient = (await request("/api/patients", admin, "POST", {
    uhid: run, name: `${run} Patient`, age: 45, gender: "Female",
    treatingNephrologist: unrelated.username,
  }, 201)).patient;
  patients.push(patient.id);
  await db.query("INSERT INTO dialysis_units(id,name) VALUES($1,$2)", [unitId, run]);
  await db.query("INSERT INTO dialysis_machines(id,unit_id,code,name,category) VALUES($1,$2,$3,$3,'Negative')", [machineId,unitId,run]);
  for (const [i, user] of [responsible, inactive].entries()) {
    await db.query(`INSERT INTO dialysis_sessions(id,patient_id,machine_id,unit_id,session_date,slot,doctor_id,created_by)
      VALUES($1,$2,$3,$4,'2098-01-01',$5,$6,$7)`,
    [randomUUID(),patient.id,machineId,unitId,`Slot ${i+1}`,user.id,otherAdmin.id]);
  }
  const machinesBefore = (await db.query("SELECT * FROM dialysis_machines WHERE id=$1",[machineId])).rows;
  const sessionsBefore = (await db.query("SELECT * FROM dialysis_sessions WHERE patient_id=$1 ORDER BY id",[patient.id])).rows;
  const body = { patientId: patient.id, requestId: randomUUID(), diagnosis: "PRIVATE-DIAGNOSIS",
    dialysisRx: { duration: "4 Hours" }, medications: [{ name: "PRIVATE-MEDICINE", dose: "PRIVATE-DOSE", frequency: "Daily", route: "PO" }],
    notes: "PRIVATE-CLINICAL-NOTE", actorId: unrelated.id, createdBy: unrelated.id, user_id: unrelated.id };
  const [first, retry] = await Promise.all([
    request("/api/prescriptions",doctor,"POST",body,[200,201]),
    // Concurrent response ordering is intentionally unspecified.
    (async () => {
      const response = await fetch(`${base}/api/prescriptions`, { method:"POST",
        headers:{"Content-Type":"application/json",Cookie:doctor}, body:JSON.stringify(body) });
      assert.ok([200,201].includes(response.status)); return response.json();
    })(),
  ]);
  const rxId = first.prescription.id;
  assert.equal(retry.prescription.id, rxId);
  assert.equal(first.prescription.created_by, primaryDoctor, "actor comes from session");
  assert.equal((await db.query("SELECT count(*)::int count FROM audit_logs WHERE entity_id=$1 AND action='prescription.create'",[rxId])).rows[0].count,1);
  const admins = (await db.query("SELECT id FROM portal_users WHERE role='admin' AND status='Active'")).rows.map(u=>u.id);
  function recipients(rows, expected) {
    assert.deepEqual(rows.map(n=>n.user_id).sort(), [...expected].sort());
    assert.equal(new Set(rows.map(n=>n.id)).size, rows.length);
    for (const n of rows) {
      assert.equal(n.patient_id,patient.id);
      assert.equal(n.record_id,rxId);
      assert.equal(n.type,"info");
      assert.ok(n.created_at && !n.read);
      assert.doesNotMatch(`${n.message} ${n.detail}`,/PRIVATE-|medications|dialysisRx/);
    }
  }
  recipients(await events(rxId), [...admins,responsible.id]);
  const initialSnapshot = (await request(`/api/prescriptions/${rxId}/history`,doctor)).history[0];
  const beforeFailed = await events(rxId);
  await request(`/api/prescriptions/${rxId}`,doctor,"PATCH",{baseVersion:0,notes:"bad"},400);
  await request(`/api/prescriptions/${rxId}`,doctor,"PATCH",{baseVersion:1,status:"Invalid"},400);
  await request("/api/prescriptions",doctor,"POST",{...body,diagnosis:"changed"},409);
  await request("/api/prescriptions",null,"POST",body,401);
  assert.deepEqual(await events(rxId),beforeFailed);
  await request(`/api/prescriptions/${rxId}`,doctor,"PATCH",{baseVersion:1,notes:"PRIVATE-REVISION"});
  recipients((await events(rxId)).filter(n=>!beforeFailed.some(old=>old.id===n.id)),[...admins,responsible.id]);
  const beforeStale = await events(rxId);
  await request(`/api/prescriptions/${rxId}`,otherAdmin.cookie,"PATCH",{baseVersion:1,notes:"stale"},409);
  assert.deepEqual(await events(rxId),beforeStale);
  await request(`/api/prescriptions/${rxId}`,otherAdmin.cookie,"PATCH",{baseVersion:2,notes:"PRIVATE-ADMIN-REVISION"});
  const adminRecipients = [...admins.filter(id=>id!==otherAdmin.id),primaryDoctor,responsible.id];
  recipients((await events(rxId)).filter(n=>!beforeStale.some(old=>old.id===n.id)),adminRecipients);
  const adminCreated = (await request("/api/prescriptions",otherAdmin.cookie,"POST",{
    ...body,requestId:randomUUID(),
  },201)).prescription;
  assert.deepEqual((await events(adminCreated.id)).map(n=>n.user_id).sort(),adminRecipients.sort());
  assert.equal((await request(`/api/prescriptions/${rxId}/history`,doctor)).history.length,3);
  assert.deepEqual((await request(`/api/prescriptions/${rxId}/history`,doctor)).history[0],initialSnapshot);
  assert.deepEqual((await db.query("SELECT * FROM dialysis_machines WHERE id=$1",[machineId])).rows,machinesBefore);
  assert.deepEqual((await db.query("SELECT * FROM dialysis_sessions WHERE patient_id=$1 ORDER BY id",[patient.id])).rows,sessionsBefore);

  const own = (await events(rxId)).find(n=>n.user_id===responsible.id);
  const foreign = (await events(rxId)).find(n=>n.user_id===otherAdmin.id);
  const list = (await request("/api/notifications", responsible.cookie)).notifications;
  assert.ok(list.some(n=>n.id===own.id));
  assert.ok(!list.some(n=>n.id===foreign.id));
  assert.ok(!(await request("/api/notifications",unrelated.cookie)).notifications.some(n=>n.record_id===rxId));
  await request(`/api/notifications/${foreign.id}`,responsible.cookie,"PATCH",{read:true},404);
  await request(`/api/notifications/${foreign.id}/target`,responsible.cookie,"GET",undefined,404);
  await request(`/api/notifications/${own.id}/target`,null,"GET",undefined,401);
  await request("/api/notifications/read-all",null,"PATCH",undefined,401);
  assert.deepEqual(await request(`/api/notifications/${own.id}/target`,responsible.cookie),{patientId:patient.id,prescriptionId:rxId,cookie:undefined});
  await request(`/api/notifications/${own.id}`,responsible.cookie,"PATCH",{read:true});
  assert.equal((await request("/api/notifications",responsible.cookie)).notifications.find(n=>n.id===own.id).read,true);
  assert.equal((await db.query("SELECT read FROM notifications WHERE id=$1",[foreign.id])).rows[0].read,false);
  await request("/api/notifications/read-all",responsible.cookie,"PATCH");
  assert.ok((await db.query("SELECT read FROM notifications WHERE user_id=$1",[responsible.id])).rows.every(n=>n.read));
  assert.equal((await db.query("SELECT read FROM notifications WHERE id=$1",[foreign.id])).rows[0].read,false);
  const disabledCookie = responsible.cookie;
  await db.query("UPDATE portal_users SET status='Inactive' WHERE id=$1",[responsible.id]);
  await request("/api/notifications",disabledCookie,"GET",undefined,401);
  await db.query("UPDATE portal_users SET status='Active' WHERE id=$1",[responsible.id]);

  await runPrescriptionNotificationUi({
    base, patient, doctor: responsible, admin: otherAdmin, request,
    create: async cookie => (await request("/api/prescriptions",cookie,"POST",{...body,requestId:randomUUID()},201)).prescription,
    primaryDoctorCookie: doctor, rxId,
  });
  console.log("prescription notifications passed: both roles create/revise, recipient isolation, assignments, self/inactive exclusion, safe previews, persistence, retries/conflicts/failures, read/bulk/link authorization, history and unchanged scheduling/machines");
} finally {
  const rxIds = patients.length ? (await db.query("SELECT id FROM prescriptions WHERE patient_id=ANY($1::text[])",[patients])).rows.map(r=>r.id) : [];
  await db.query("DELETE FROM notifications WHERE patient_id=ANY($1::text[]) OR user_id=ANY($2::text[]) OR detail LIKE $3",[patients,users,`%${run}%`]);
  await db.query("DELETE FROM audit_logs WHERE entity_id=ANY($1::text[]) OR actor_id=ANY($2::text[])",[[...patients,...rxIds],users]);
  await db.query("DELETE FROM prescription_versions WHERE prescription_id=ANY($1::text[])",[rxIds]);
  await db.query("DELETE FROM prescriptions WHERE patient_id=ANY($1::text[])",[patients]);
  await db.query("DELETE FROM dialysis_sessions WHERE patient_id=ANY($1::text[])",[patients]);
  await db.query("DELETE FROM patients WHERE id=ANY($1::text[])",[patients]);
  await db.query("DELETE FROM dialysis_machines WHERE id=$1",[machineId]);
  await db.query("DELETE FROM dialysis_units WHERE id=$1",[unitId]);
  await db.query("DELETE FROM portal_users WHERE id=ANY($1::text[])",[users]);
  for (const n of sharedReadState) await db.query("UPDATE notifications SET read=$2 WHERE id=$1",[n.id,n.read]);
  await db.end();
}
