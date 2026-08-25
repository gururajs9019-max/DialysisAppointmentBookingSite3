import { createServer } from "node:http";
import { createHmac, pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 5000);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) throw new Error("SESSION_SECRET must be configured before starting the appointment service.");

const APPOINTMENT_FIELDS = ["firstName", "lastName", "dateOfBirth", "phone", "email", "medicalId", "appointmentDate", "appointmentTime", "dialysisType"];
const ROLES = ["doctor", "admin"];
const LIFECYCLES = ["Active", "Transplanted", "Expired", "Shifted", "Discontinued"];
const MACHINE_CATEGORIES = ["Negative", "HCV", "HBsAg", "HIV", "RVD (HIV)"];
const SESSION_STATUSES = ["scheduled", "waiting", "running", "completed", "missed", "cancelled"];

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(status === 204 ? undefined : JSON.stringify(body));
}
function httpError(statusCode, message) { const error = new Error(message); error.statusCode = statusCode; return error; }
function text(value, field, { required = false, max = 2000 } = {}) {
  if (value == null && !required) return undefined;
  if (typeof value !== "string" || (required && !value.trim()) || value.length > max) throw httpError(400, `Invalid ${field}.`);
  return value.trim();
}
function object(value, field = "payload") {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw httpError(400, `${field} must be an object.`);
  return value;
}
async function readJson(req) {
  let body = ""; for await (const chunk of req) { body += chunk; if (body.length > 1_000_000) throw httpError(413, "Request body is too large."); }
  if (!body) return {};
  try { return JSON.parse(body); } catch { throw httpError(400, "Request body must be valid JSON."); }
}
function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  return `${salt}:${pbkdf2Sync(password, salt, 210_000, 32, "sha256").toString("hex")}`;
}
function passwordsMatch(password, stored) {
  const [salt, hash] = String(stored).split(":"); if (!salt || !hash) return false;
  const a = Buffer.from(hashPassword(password, salt).split(":")[1], "hex"), b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
function signSession(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${createHmac("sha256", sessionSecret).update(encoded).digest("base64url")}`;
}
function sessionCookie(user) { return `kmcri_session=${signSession({ userId: user.id, expiresAt: Date.now() + 28_800_000 })}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`; }
function clearSessionCookie() { return "kmcri_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"; }
function cookie(req, name) { return req.headers.cookie?.split(";").map(x => x.trim()).find(x => x.startsWith(`${name}=`))?.slice(name.length + 1) ?? null; }
async function getSessionUser(req) {
  const token = cookie(req, "kmcri_session"); if (!token) return null;
  const [encoded, signature] = token.split("."); if (!encoded || !signature) return null;
  const expected = createHmac("sha256", sessionSecret).update(encoded).digest("base64url");
  const a = Buffer.from(signature), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString());
    if (!payload.userId || payload.expiresAt < Date.now()) return null;
    return (await pool.query("SELECT id, username, email, name, role FROM portal_users WHERE id=$1", [payload.userId])).rows[0] ?? null;
  } catch { return null; }
}
async function requireStaff(req, role) {
  const user = await getSessionUser(req);
  if (!user) throw httpError(401, "Sign in is required.");
  if (!ROLES.includes(user.role) || (role === "admin" && user.role !== "admin")) throw httpError(403, "You are not authorised for this action.");
  return user;
}
async function audit(client, actor, action, entityType, entityId, metadata = {}) {
  await client.query("INSERT INTO audit_logs (id,actor_id,action,entity_type,entity_id,metadata) VALUES ($1,$2,$3,$4,$5,$6)", [randomUUID(), actor.id, action, entityType, entityId, metadata]);
}
async function notifyRole(client, actor, targetRole, type, message, detail) {
  const recipients = (await client.query("SELECT id FROM portal_users WHERE role=$1 AND id<>$2", [targetRole, actor.id])).rows;
  for (const recipient of recipients) {
    await client.query(
      "INSERT INTO notifications(id,user_id,type,message,detail) VALUES($1,$2,$3,$4,$5)",
      [randomUUID(), recipient.id, type, message, detail],
    );
  }
}
async function transaction(work) { const client = await pool.connect(); try { await client.query("BEGIN"); const value = await work(client); await client.query("COMMIT"); return value; } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); } }

let staffUsersPromise;
async function ensureStaffUsers() {
  if (!staffUsersPromise) staffUsersPromise = (async () => {
    const accounts = [
      ["admin1", "admin1@kmcri.test", "Priya Sharma", "admin", process.env.STAFF_ADMIN_PASSWORD],
      ["doctor1", "doctor@kmcri.test", "Dr. Rajesh Verma", "doctor", process.env.STAFF_DOCTOR_PASSWORD],
    ];
    for (const [username, email, name, role, password] of accounts) if (typeof password === "string" && password.length >= 12) {
      await pool.query(`INSERT INTO portal_users(id,username,email,name,role,password_hash) VALUES($1,$2,$3,$4,$5,$6)
        ON CONFLICT(email) DO NOTHING`, [randomUUID(), username, email, name, role, hashPassword(password)]);
    }
  })(); return staffUsersPromise;
}
async function login(input) {
  object(input); const role = text(input.role, "role", { required: true }), identifier = text(input.identifier, "identifier", { required: true }), password = text(input.password, "password", { required: true });
  if (!ROLES.includes(role)) throw httpError(400, "Invalid staff role.");
  await ensureStaffUsers();
  const user = (await pool.query("SELECT * FROM portal_users WHERE role=$1 AND (username=$2 OR LOWER(email)=LOWER($2))", [role, identifier])).rows[0];
  if (!user || !passwordsMatch(password, user.password_hash)) throw httpError(401, "Invalid username or password.");
  return user;
}

export function requiredViralCategory(viral = {}) {
  if (viral.hepatitisB === "Positive") return "HBsAg";
  if (viral.hepatitisC === "Positive") return "HCV";
  if (viral.hiv === "Positive") return "HIV";
  return "Negative";
}
export function compatibleMachine(category, machineCategory) {
  return category === "HIV" ? ["HIV", "RVD (HIV)"].includes(machineCategory) : category === machineCategory;
}
export function validatePatient(input, partial = false) {
  object(input); const out = {};
  if (!partial || "uhid" in input) { out.uhid = text(input.uhid, "UHID", { required: true, max: 80 }); }
  if (!partial || "name" in input) out.name = text(input.name, "name", { required: true });
  if ("viralStatus" in input) { object(input.viralStatus, "viralStatus"); out.viralStatus = input.viralStatus; out.viralCategory = requiredViralCategory(input.viralStatus); }
  if ("treatmentStatus" in input) { if (!LIFECYCLES.includes(input.treatmentStatus)) throw httpError(400, "Invalid treatment status."); out.treatmentStatus = input.treatmentStatus; }
  for (const key of ["age", "gender", "mobile", "address", "city", "primaryDisease", "causeOfFailure", "biopsyDone", "biopsyDetails", "comorbidities", "bloodGroup", "dialysisStartDate", "referredBy", "treatingNephrologist", "emergencyContact", "insurance", "remarks", "dialysisDaysPerWeek", "dialysisDays", "registrationFields", "medicalInfo", "investigations"]) if (key in input) out[key] = input[key];
  return out;
}
function patientDto(row) { const data = row.data; return { id: row.id, uhid: row.uhid, ...data, treatmentStatus: row.lifecycle, viralStatus: data.viralStatus ?? {}, createdAt: row.created_at, updatedAt: row.updated_at }; }
async function fetchPatient(client, id) {
  const row = (await client.query("SELECT * FROM patients WHERE id=$1", [id])).rows[0]; if (!row) throw httpError(404, "Patient was not found."); return row;
}
async function createSession(input, actor) {
  object(input); const patientId = text(input.patientId, "patientId", { required: true, max: 100 }), machineId = text(input.machineId, "machineId", { required: true, max: 100 }), unitId = text(input.unitId, "unitId", { required: true, max: 100 });
  const date = text(input.date, "date", { required: true, max: 10 }), slot = text(input.slot, "slot", { required: true, max: 80 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw httpError(400, "date must be YYYY-MM-DD.");
  return transaction(async client => {
    const patient = await fetchPatient(client, patientId);
    if (patient.lifecycle !== "Active") throw httpError(409, "Only active patients can be scheduled.");
    const machine = (await client.query("SELECT * FROM dialysis_machines WHERE id=$1 AND unit_id=$2 FOR UPDATE", [machineId, unitId])).rows[0];
    if (!machine) throw httpError(400, "Machine does not belong to the selected unit.");
    if (!["available", "scheduled", "in-use"].includes(machine.status)) throw httpError(409, "Machine is unavailable.");
    if (!compatibleMachine(patient.viral_category, machine.category)) throw httpError(409, "Machine is not compatible with the patient's viral category.");
    const id = randomUUID(), status = input.status && SESSION_STATUSES.includes(input.status) ? input.status : "scheduled";
    try { await client.query("INSERT INTO dialysis_sessions(id,patient_id,machine_id,unit_id,session_date,slot,status,data,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)", [id, patientId, machineId, unitId, date, slot, status, { ...input, date, slot }, actor.id]); }
    catch (e) { if (e.code === "23505") throw httpError(409, "Patient or machine is already booked for this date and slot."); throw e; }
    await audit(client, actor, "session.create", "session", id, { patientId, machineId, date, slot });
    await notifyRole(client, actor, actor.role === "doctor" ? "admin" : "doctor", "info", "Dialysis session scheduled", `${patient.data.name} (${patient.uhid}) was scheduled for ${date}, ${slot}.`);
    return sessionDto((await client.query("SELECT s.*,p.uhid,p.data AS patient_data,m.code,m.name AS machine_name,u.name AS unit_name FROM dialysis_sessions s JOIN patients p ON p.id=s.patient_id JOIN dialysis_machines m ON m.id=s.machine_id JOIN dialysis_units u ON u.id=s.unit_id WHERE s.id=$1", [id])).rows[0]);
  });
}
function sessionDto(r) { return { id:r.id, patientId:r.patient_id, patientName:r.patient_data.name, uhid:r.uhid, machineId:r.machine_id, machine:r.machine_name, unitId:r.unit_id, unit:r.unit_name, date:r.session_date, slot:r.slot, status:r.status, ...r.data, createdAt:r.created_at, updatedAt:r.updated_at }; }

async function appointmentList() { return (await pool.query("SELECT data FROM dialysis_appointments ORDER BY data->>'appointmentDate',data->>'appointmentTime',created_at")).rows.map(r => r.data); }
async function appointmentCreate(input) {
  object(input); const missing = APPOINTMENT_FIELDS.filter(k => typeof input[k] !== "string" || !input[k].trim()); if (missing.length) throw httpError(400, `Missing required fields: ${missing.join(", ")}`);
  const now = new Date().toISOString(), appointment = { ...input, id:randomUUID(), status:"upcoming", createdAt:now, location:text(input.location, "location") || "KMC-RI Hospital Dialysis Centre" };
  appointment.patientName = `${appointment.firstName} ${appointment.lastName}`.trim(); appointment.patientMRN = appointment.medicalId;
  await pool.query("INSERT INTO dialysis_appointments(id,data,status) VALUES($1,$2,$3)", [appointment.id,appointment,appointment.status]); return appointment;
}
async function appointmentUpdate(id, input) {
  object(input); const allowed = ["status","appointmentDate","appointmentTime","dialysisType","notes","location"], changes = Object.fromEntries(Object.entries(input).filter(([k,v]) => allowed.includes(k) && typeof v === "string"));
  if (changes.status && !["upcoming","completed","cancelled"].includes(changes.status)) throw httpError(400,"Invalid appointment status.");
  if (!Object.keys(changes).length) throw httpError(400,"No supported appointment changes were provided.");
  const result = await pool.query("UPDATE dialysis_appointments SET data=data || $2::jsonb,status=COALESCE($3,status),updated_at=now() WHERE id=$1 RETURNING data",[id,changes,changes.status||null]);
  if (!result.rowCount) throw httpError(404,"Appointment was not found."); return result.rows[0].data;
}

async function api(req, res, url) {
  const path = url.pathname, parts = path.split("/").filter(Boolean);
  try {
    if (req.method === "POST" && path === "/api/auth/login") { const user = await login(await readJson(req)); const { password_hash, ...safe } = user; sendJson(res,200,{user:safe},{"Set-Cookie":sessionCookie(user)}); return true; }
    if (req.method === "POST" && path === "/api/auth/logout") { sendJson(res,204,{},{"Set-Cookie":clearSessionCookie()}); return true; }
    if (req.method === "GET" && path === "/api/auth/me") { const user=await requireStaff(req); sendJson(res,200,{user}); return true; }
    if (path === "/api/appointments") { await requireStaff(req); if(req.method==="GET") sendJson(res,200,{appointments:await appointmentList()}); else if(req.method==="POST") sendJson(res,201,{appointment:await appointmentCreate(await readJson(req))}); else throw httpError(405,"Method not allowed."); return true; }
    if (parts[1]==="appointments" && parts.length===3 && req.method==="PATCH") { await requireStaff(req); sendJson(res,200,{appointment:await appointmentUpdate(decodeURIComponent(parts[2]),await readJson(req))}); return true; }

    if (path === "/api/users" && req.method === "GET") { await requireStaff(req,"admin"); const r=await pool.query("SELECT id,username,email,name,role,created_at FROM portal_users ORDER BY name"); sendJson(res,200,{users:r.rows}); return true; }
    if (path === "/api/users" && req.method === "POST") { const actor=await requireStaff(req,"admin"), x=object(await readJson(req)), role=text(x.role,"role",{required:true}); if(!ROLES.includes(role)) throw httpError(400,"Invalid staff role."); const password=text(x.password,"password",{required:true,max:512}); if(password.length<12) throw httpError(400,"Password must be at least 12 characters."); const id=randomUUID(); try { const r=await pool.query("INSERT INTO portal_users(id,username,email,name,role,password_hash) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,username,email,name,role,created_at",[id,text(x.username,"username",{max:80})||null,text(x.email,"email",{required:true,max:320}),text(x.name,"name",{required:true}),role,hashPassword(password)]); await transaction(c=>audit(c,actor,"user.create","user",id,{role})); sendJson(res,201,{user:r.rows[0]}); } catch(e) { if(e.code==="23505") throw httpError(409,"Username or email already exists."); throw e; } return true; }

    if (path === "/api/patients" && req.method === "GET") { await requireStaff(req); const q=url.searchParams.get("q"); const r=await pool.query(`SELECT * FROM patients ${q ? "WHERE uhid ILIKE $1 OR data->>'name' ILIKE $1" : ""} ORDER BY created_at DESC`,q?[`%${q}%`]:[]); sendJson(res,200,{patients:r.rows.map(patientDto)}); return true; }
    if (path === "/api/patients" && req.method === "POST") { const actor=await requireStaff(req,"admin"), values=validatePatient(await readJson(req)); const id=randomUUID(); try { const row=await pool.query("INSERT INTO patients(id,uhid,data,viral_category,lifecycle) VALUES($1,$2,$3,$4,$5) RETURNING *",[id,values.uhid,values,values.viralCategory||"Negative",values.treatmentStatus||"Active"]); await transaction(c=>audit(c,actor,"patient.create","patient",id)); sendJson(res,201,{patient:patientDto(row.rows[0])}); } catch(e) { if(e.code==="23505") throw httpError(409,"UHID already exists."); throw e; } return true; }
    if (parts[1]==="patients" && parts.length===3 && req.method==="GET") { await requireStaff(req); sendJson(res,200,{patient:patientDto(await fetchPatient(pool,decodeURIComponent(parts[2])))}); return true; }
    if (parts[1]==="patients" && parts.length===3 && req.method==="PATCH") { const actor=await requireStaff(req,"admin"), id=decodeURIComponent(parts[2]), values=validatePatient(await readJson(req),true); const row=await fetchPatient(pool,id); const lifecycle=values.treatmentStatus||row.lifecycle, data={...row.data,...values}; const r=await pool.query("UPDATE patients SET uhid=COALESCE($2,uhid),data=$3,viral_category=$4,lifecycle=$5,updated_at=now() WHERE id=$1 RETURNING *",[id,values.uhid||null,data,values.viralCategory||row.viral_category,lifecycle]); await transaction(c=>audit(c,actor,"patient.update","patient",id)); sendJson(res,200,{patient:patientDto(r.rows[0])}); return true; }

    if (path === "/api/units" && req.method==="GET") { await requireStaff(req); sendJson(res,200,{units:(await pool.query("SELECT id,name,active,created_at FROM dialysis_units ORDER BY name")).rows}); return true; }
    if (path === "/api/units" && req.method==="POST") { const actor=await requireStaff(req,"admin"), input=object(await readJson(req)), id=randomUUID(), name=text(input.name,"name",{required:true}); const r=await pool.query("INSERT INTO dialysis_units(id,name) VALUES($1,$2) RETURNING id,name,active",[id,name]); await transaction(c=>audit(c,actor,"unit.create","unit",id)); sendJson(res,201,{unit:r.rows[0]}); return true; }
    if (path === "/api/machines" && req.method==="GET") { await requireStaff(req); sendJson(res,200,{machines:(await pool.query("SELECT * FROM dialysis_machines ORDER BY code")).rows}); return true; }
    if (path === "/api/machines" && req.method==="POST") { const actor=await requireStaff(req,"admin"), x=object(await readJson(req)), id=randomUUID(), category=text(x.category,"category",{required:true}); if(!MACHINE_CATEGORIES.includes(category)) throw httpError(400,"Invalid machine category."); const r=await pool.query("INSERT INTO dialysis_machines(id,unit_id,code,name,category,status,notes) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",[id,text(x.unitId,"unitId",{required:true}),text(x.code,"machine code",{required:true,max:80}),text(x.name,"name",{required:true}),category,x.status||"available",text(x.notes,"notes")||""]); await transaction(c=>audit(c,actor,"machine.create","machine",id)); sendJson(res,201,{machine:r.rows[0]}); return true; }
    if (parts[1]==="machines" && parts.length===3 && req.method==="PATCH") { const actor=await requireStaff(req,"admin"), x=object(await readJson(req)), id=decodeURIComponent(parts[2]); const fields=["status","notes","name"], changes=Object.fromEntries(Object.entries(x).filter(([k,v])=>fields.includes(k)&&typeof v==="string")); if(!Object.keys(changes).length) throw httpError(400,"No supported machine changes."); if(changes.status && !["available","in-use","scheduled","maintenance","disabled"].includes(changes.status)) throw httpError(400,"Invalid machine status."); const r=await pool.query("UPDATE dialysis_machines SET name=COALESCE($2,name),status=COALESCE($3,status),notes=COALESCE($4,notes),updated_at=now() WHERE id=$1 RETURNING *",[id,changes.name||null,changes.status||null,changes.notes||null]); if(!r.rowCount) throw httpError(404,"Machine was not found."); await transaction(c=>audit(c,actor,"machine.update","machine",id)); sendJson(res,200,{machine:r.rows[0]}); return true; }

    if (path === "/api/sessions" && req.method==="GET") { await requireStaff(req); const r=await pool.query("SELECT s.*,p.uhid,p.data patient_data,m.code,m.name machine_name,u.name unit_name FROM dialysis_sessions s JOIN patients p ON p.id=s.patient_id JOIN dialysis_machines m ON m.id=s.machine_id JOIN dialysis_units u ON u.id=s.unit_id ORDER BY session_date DESC,slot"); sendJson(res,200,{sessions:r.rows.map(sessionDto)}); return true; }
    if (path === "/api/sessions" && req.method==="POST") { const actor=await requireStaff(req); sendJson(res,201,{session:await createSession(await readJson(req),actor)}); return true; }
    if (parts[1]==="sessions" && parts.length===3 && req.method==="PATCH") { const actor=await requireStaff(req), id=decodeURIComponent(parts[2]), x=object(await readJson(req)); if(!SESSION_STATUSES.includes(x.status)) throw httpError(400,"Invalid session status."); const r=await pool.query("UPDATE dialysis_sessions SET status=$2,data=data || $3::jsonb,updated_at=now() WHERE id=$1 RETURNING *",[id,x.status,x]); if(!r.rowCount) throw httpError(404,"Session was not found."); await transaction(c=>audit(c,actor,"session.update","session",id,{status:x.status})); sendJson(res,200,{session:r.rows[0]}); return true; }
    if (path === "/api/missed-slots" && req.method==="GET") { await requireStaff(req); const r=await pool.query("SELECT * FROM dialysis_sessions WHERE status='missed' ORDER BY session_date DESC"); sendJson(res,200,{missedSlots:r.rows}); return true; }

    if (path === "/api/prescriptions" && req.method==="GET") { await requireStaff(req); const r=await pool.query("SELECT p.*,pt.uhid,pt.data patient_data,creator.name created_by_name,creator.role created_by_role,editor.name updated_by_name,editor.role updated_by_role FROM prescriptions p JOIN patients pt ON pt.id=p.patient_id LEFT JOIN portal_users creator ON creator.id=p.created_by LEFT JOIN LATERAL (SELECT changed_by FROM prescription_versions WHERE prescription_id=p.id ORDER BY version DESC LIMIT 1) latest_version ON true LEFT JOIN portal_users editor ON editor.id=latest_version.changed_by ORDER BY p.updated_at DESC"); sendJson(res,200,{prescriptions:r.rows.map(x=>({id:x.id,patientId:x.patient_id,patientName:x.patient_data.name,patientUhid:x.uhid,version:x.version,status:x.status,...x.data,createdAt:x.created_at,updatedAt:x.updated_at,createdBy:x.created_by_name||"Staff",createdByRole:x.created_by_role||"Doctor",updatedBy:x.updated_by_name||x.created_by_name||"Staff",updatedByRole:x.updated_by_role||x.created_by_role||"Doctor"}))}); return true; }
    if (path === "/api/prescriptions" && req.method==="POST") { const actor=await requireStaff(req), x=object(await readJson(req)), patient=await fetchPatient(pool,text(x.patientId,"patientId",{required:true})); if(patient.lifecycle!=="Active") throw httpError(409,"Cannot prescribe for an inactive patient."); const id=randomUUID(); const created=await transaction(async c=>{ const r=await c.query("INSERT INTO prescriptions(id,patient_id,data,created_by) VALUES($1,$2,$3,$4) RETURNING *",[id,patient.id,x,actor.id]); await c.query("INSERT INTO prescription_versions(id,prescription_id,version,snapshot,changed_by) VALUES($1,$2,1,$3,$4)",[randomUUID(),id,x,actor.id]); await audit(c,actor,"prescription.create","prescription",id,{version:1}); await notifyRole(c,actor,actor.role==="doctor"?"admin":"doctor","info","Prescription created",`${patient.data.name} (${patient.uhid}) prescription v1 was created.`); return r.rows[0]; }); sendJson(res,201,{prescription:created}); return true; }
    if (parts[1]==="prescriptions" && parts.length===3 && req.method==="PATCH") { const actor=await requireStaff(req), id=decodeURIComponent(parts[2]), x=object(await readJson(req)); const updated=await transaction(async c=>{const old=(await c.query("SELECT * FROM prescriptions WHERE id=$1 FOR UPDATE",[id])).rows[0]; if(!old) throw httpError(404,"Prescription was not found."); const patient=await fetchPatient(c,old.patient_id); const status=x.status||"Revised"; if(!["Active","Revised","Discontinued"].includes(status)) throw httpError(400,"Invalid prescription status."); const next={...old.data,...x}; const changedFields=Object.keys(x).filter(key=>JSON.stringify(old.data[key])!==JSON.stringify(x[key])); const r=await c.query("UPDATE prescriptions SET version=version+1,status=$2,data=$3,updated_at=now() WHERE id=$1 RETURNING *",[id,status,next]); await c.query("INSERT INTO prescription_versions(id,prescription_id,version,snapshot,changed_by) VALUES($1,$2,$3,$4,$5)",[randomUUID(),id,r.rows[0].version,next,actor.id]); await audit(c,actor,"prescription.revise","prescription",id,{version:r.rows[0].version,changedFields}); await notifyRole(c,actor,actor.role==="doctor"?"admin":"doctor","info","Prescription revised",`${patient.data.name} (${patient.uhid}) prescription v${r.rows[0].version}; changed: ${changedFields.join(", ") || "status"}.`); return r.rows[0];}); sendJson(res,200,{prescription:updated}); return true; }
    if (parts[1]==="prescriptions" && parts[3]==="history" && req.method==="GET") { await requireStaff(req); const r=await pool.query("SELECT pv.version,pv.snapshot,pv.created_at,pv.changed_by,u.name changed_by_name,u.role changed_by_role FROM prescription_versions pv LEFT JOIN portal_users u ON u.id=pv.changed_by WHERE pv.prescription_id=$1 ORDER BY pv.version",[decodeURIComponent(parts[2])]); sendJson(res,200,{history:r.rows}); return true; }

    if (path === "/api/clinical-notes" && req.method==="POST") { const actor=await requireStaff(req), x=object(await readJson(req)), id=randomUUID(); await fetchPatient(pool,text(x.patientId,"patientId",{required:true})); const r=await pool.query("INSERT INTO clinical_notes(id,patient_id,session_id,body,author_id) VALUES($1,$2,$3,$4,$5) RETURNING *",[id,x.patientId,x.sessionId||null,text(x.body,"note",{required:true,max:10000}),actor.id]); await transaction(c=>audit(c,actor,"note.create","clinical_note",id)); sendJson(res,201,{note:r.rows[0]}); return true; }
    if (parts[1]==="patients" && parts[3]==="clinical-notes" && req.method==="GET") { await requireStaff(req); const r=await pool.query("SELECT n.*,u.name author_name FROM clinical_notes n JOIN portal_users u ON u.id=n.author_id WHERE patient_id=$1 ORDER BY created_at DESC",[decodeURIComponent(parts[2])]); sendJson(res,200,{notes:r.rows}); return true; }
    if (path === "/api/notifications" && req.method==="GET") { const user=await requireStaff(req); const r=await pool.query("SELECT * FROM notifications WHERE user_id IS NULL OR user_id=$1 ORDER BY created_at DESC",[user.id]); sendJson(res,200,{notifications:r.rows}); return true; }
    if (parts[1]==="notifications" && parts.length===3 && req.method==="PATCH") { const user=await requireStaff(req), id=decodeURIComponent(parts[2]), x=object(await readJson(req)); if(typeof x.read!=="boolean") throw httpError(400,"read must be boolean."); const r=await pool.query("UPDATE notifications SET read=$2 WHERE id=$1 AND (user_id IS NULL OR user_id=$3) RETURNING *",[id,x.read,user.id]); if(!r.rowCount) throw httpError(404,"Notification was not found."); sendJson(res,200,{notification:r.rows[0]}); return true; }
    if (path === "/api/analytics" && req.method==="GET") { await requireStaff(req); const r=await pool.query("SELECT (SELECT count(*) FROM patients) patients,(SELECT count(*) FROM patients WHERE lifecycle='Active') active_patients,(SELECT count(*) FROM dialysis_machines WHERE status='available') available_machines,(SELECT count(*) FROM dialysis_sessions WHERE session_date=current_date AND status NOT IN ('cancelled','missed')) today_sessions,(SELECT count(*) FROM dialysis_sessions WHERE status='missed' AND session_date >= current_date-30) missed_last_30_days"); sendJson(res,200,{analytics:r.rows[0]}); return true; }
    if (path === "/api/audit-logs" && req.method==="GET") { await requireStaff(req,"admin"); const r=await pool.query("SELECT a.*,u.name actor_name,u.role actor_role FROM audit_logs a LEFT JOIN portal_users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 500"); sendJson(res,200,{auditLogs:r.rows}); return true; }
    if (path.startsWith("/api/")) { sendJson(res,404,{error:"API route not found"}); return true; } return false;
  } catch (error) { const status=error.statusCode || (error.code === "42P01" ? 503 : 500); if(status>=500) console.error("API error:",error); sendJson(res,status,{error:error.message || "Unexpected server error."}); return true; }
}

async function start() {
  const production = process.env.NODE_ENV === "production";
  const distRoot = normalize(join(__dirname, "..", "dist"));
  async function serveProductionAsset(res, pathname) {
    const requestedPath = normalize(join(distRoot, pathname === "/" ? "index.html" : pathname));
    if (requestedPath !== distRoot && !requestedPath.startsWith(`${distRoot}/`)) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    try {
      res.end(await readFile(requestedPath));
    } catch {
      res.end(await readFile(join(distRoot, "index.html")));
    }
  }

  let vite;
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (await api(req, res, url)) return;
    if (production) {
      await serveProductionAsset(res, url.pathname);
      return;
    }
    vite.middlewares(req, res, () => {
      if (res.writableEnded) return;
      res.statusCode = 404;
      res.end("Not found");
    });
  });
  if (!production) {
    const { createServer: createViteServer } = await import("vite");
    vite = await createViteServer({ server: { middlewareMode: true, hmr: { server } }, appType: "spa" });
  }
  server.listen(port, "0.0.0.0", () => console.log(`Dialysis appointment server listening on port ${port}`));
}
if (process.env.NODE_ENV !== "test") start().catch(error=>{console.error("Unable to start application:",error);process.exitCode=1;});