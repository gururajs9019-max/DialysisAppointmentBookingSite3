import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { chromium } from "playwright";

const base = process.env.TEST_BASE_URL || "http://127.0.0.1:5000";
const db = new Pool({ connectionString: process.env.DATABASE_URL });
const run = `GAP-${randomUUID().slice(0,8)}`;
const ids = { patients: [], users: [], machines: [], notes: [] };
async function req(path, cookie, method="GET", body, expected=200) {
  const response=await fetch(`${base}${path}`,{method,headers:{"Content-Type":"application/json",...(cookie?{Cookie:cookie}:{})},
    body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json().catch(()=>({}));
  assert.equal(response.status,expected,`${method} ${path}: ${data.error||""}`);
  return { ...data, cookie:response.headers.get("set-cookie")?.split(";")[0] };
}
async function login(role,identifier,password,expected=200) {
  return (await req("/api/auth/login",null,"POST",{role,identifier,password},expected)).cookie;
}
async function verifySavedNotesInBrowser(email,password,patient,noteId,cookie) {
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    const errors=[];page.on("pageerror",e=>errors.push(e.message));
    const signIn=async()=>{
      await page.goto(base);
      await page.getByRole("button",{name:/Doctor Portal/}).click();
      await page.getByPlaceholder("doctor@kmcri.com").fill(email);
      await page.getByPlaceholder("••••••••").fill(password);
      await page.getByRole("button",{name:"Login to Portal",exact:true}).click();
      await page.getByRole("heading",{name:"Doctor Command Center",exact:true}).waitFor();
      await page.getByRole("button",{name:"Notes",exact:true}).click();
    };
    await signIn();
    const heading=page.getByRole("heading",{name:`${run} reviewed`,exact:true});
    await heading.waitFor();
    await heading.locator("xpath=../../..").getByTitle("Edit clinical note").click();
    await page.getByPlaceholder("Enter note title...").fill(`${run} browser reviewed`);
    await page.getByPlaceholder("Enter detailed clinical observations, treatment notes, and patient status...").fill(`${run} saved in browser`);
    await page.getByRole("button",{name:"Save Note",exact:true}).click();
    await page.getByRole("heading",{name:`${run} browser reviewed`,exact:true}).waitFor();
    await page.reload();
    await signIn();
    await page.getByRole("heading",{name:`${run} browser reviewed`,exact:true}).click();
    await page.getByText(`${run} saved in browser`,{exact:true}).waitFor();
    await req(`/api/clinical-notes/${noteId}`,cookie,"PATCH",{body:`${run} synchronized note`,data:{title:`${run} synchronized`}});
    await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
    await page.getByRole("heading",{name:`${run} synchronized`,exact:true}).waitFor();
    await page.goto(base);
    await page.getByRole("button",{name:/Administrator Portal/}).click();
    await page.getByLabel("Username").fill("admin1");
    await page.getByLabel("Password").fill(process.env.STAFF_ADMIN_PASSWORD);
    await page.getByRole("button",{name:"Sign In",exact:true}).click();
    await page.getByRole("heading",{name:"Today's Dialysis Patients"}).waitFor();
    await page.getByRole("button",{name:"Treatment Status",exact:true}).click();
    await page.getByRole("button").filter({has:page.getByText(patient.name,{exact:true})}).first().click();
    await page.getByRole("button",{name:"Edit Clinical Information",exact:true}).click();
    const dialog=page.getByRole("dialog");
    await dialog.getByLabel("CBC — Hb",{exact:true}).fill("12.2");
    await dialog.getByRole("button",{name:"Save Clinical Information",exact:true}).click();
    await dialog.waitFor({state:"hidden"});
    const reloaded=(await req(`/api/patients/${patient.id}`,cookie)).patient;
    assert.equal(reloaded.investigations.cbc.hb,"12.2");
    assert.equal(reloaded.investigations.cbc.tlc,"7000","editing one value must preserve the other investigation fields");
    assert.deepEqual(errors,[],"staff note screens should not have runtime errors");
  } finally {await browser.close();}
}
try {
  const admin=await login("admin","admin1",process.env.STAFF_ADMIN_PASSWORD);
  const doctor=await login("doctor","doctor1",process.env.STAFF_DOCTOR_PASSWORD);
  await req("/api/users",doctor,"GET",undefined,403);
  const password=`${randomUUID()}-X7`;
  const account=(await req("/api/users",admin,"POST",{role:"doctor",name:run,email:`${run}@example.test`,
    password,employeeId:run,phone:"1234567890",specialization:"Nephrology"},201)).user;
  ids.users.push(account.id);
  assert.equal(account.employeeId,run);
  assert.ok(!("password_hash" in account));
  const newDoctor=await login("doctor",account.email,password);
  const edited=(await req(`/api/users/${account.id}`,admin,"PATCH",{name:`${run} updated`,phone:"9876543210"})).user;
  assert.equal(edited.phone,"9876543210");
  assert.equal((await req("/api/users",admin)).users.find(u=>u.id===account.id).name,`${run} updated`);
  const clinical={
    dateOfBirth:"1980-02-03",registeredDate:"2026-01-01",
    registrationFields:{opdIpd:"OPD"},medicalInfo:{avFistula:"Yes",hypertension:"Yes"},
    investigations:{cbc:{hb:"11.5",tlc:"7000",plt:"200000",mcv:"90"},
      serumFerritin:"300",serumCalcium:"9",thyroidProfile:{t3:"1",t4:"8",tsh:"2"},
      twoDEcho:"Normal",ejectionFraction:"60",serumPhosphorous:"4",
      rft:{urea:"100",creatinine:"8"},lft:{totalProtein:"7",albumin:"4",ast:"20",alt:"25",alp:"90"}},
  };
  const patient=(await req("/api/patients",admin,"POST",{uhid:run,name:run,gender:"Male",age:46,
    comorbidities:"Hypertension",viralStatus:{hepatitisB:"Negative",hepatitisC:"Negative",hiv:"Negative"},...clinical},201)).patient;
  ids.patients.push(patient.id);
  const saved=(await req(`/api/patients/${patient.id}`,doctor)).patient;
  assert.deepEqual(saved.investigations,clinical.investigations);
  assert.deepEqual(saved.medicalInfo,clinical.medicalInfo);
  assert.equal(saved.dateOfBirth,clinical.dateOfBirth);
  const note=(await req("/api/clinical-notes",newDoctor,"POST",{patientId:patient.id,body:"Original assessment",
    data:{title:"Assessment",noteType:"assessment",vitals:{bloodPressure:"120/80",weight:"60"}}},201)).note;
  ids.notes.push(note.id);
  await req(`/api/clinical-notes/${note.id}`,doctor,"PATCH",{body:"Not my note"},403);
  await req(`/api/clinical-notes/${note.id}`,newDoctor,"PATCH",{body:"Revised assessment",data:{title:`${run} reviewed`,vitals:{bloodPressure:"125/80",weight:"61"}}});
  const reloaded=(await req("/api/clinical-notes",doctor)).notes.find(n=>n.id===note.id);
  assert.equal(reloaded.body,"Revised assessment");
  assert.equal(reloaded.data.title,`${run} reviewed`);
  assert.equal(reloaded.data.vitals.weight,"61");
  const machine=(await req("/api/machines",admin,"POST",{code:run,name:run,unitId:"U1",category:"Negative"},201)).machine;
  ids.machines.push(machine.id);
  const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);
  const day=tomorrow.toISOString().slice(0,10);
  const session=(await req("/api/sessions",admin,"POST",{patientId:patient.id,machineId:machine.id,unitId:"U1",
    date:day,slot:"Slot 1",status:"scheduled",startTime:"08:00",endTime:"12:00",duration:"4 hours"},201)).session;
  await req(`/api/sessions/${session.id}`,admin,"PATCH",{status:"scheduled",vitals:{bp:"120/80",heartRate:"72"},
    complications:["Hypotension"],importantNote:`${run} observation`});
  const sessionReloaded=(await req("/api/sessions",doctor)).sessions.find(s=>s.id===session.id);
  assert.equal(sessionReloaded.vitals.bp,"120/80");
  assert.deepEqual(sessionReloaded.complications,["Hypotension"]);
  assert.equal(sessionReloaded.importantNote,`${run} observation`);
  await req(`/api/patients/${patient.id}`,admin,"PATCH",{viralStatus:{hepatitisB:"Positive"}});
  const partial=(await req(`/api/patients/${patient.id}`,admin,"PATCH",{viralStatus:{hiv:"Negative"}})).patient;
  assert.equal(partial.viralCategory,"HBsAg");
  const stats=(await req(`/api/analytics?from=${day}&to=${day}&unit=U1`,doctor)).analytics;
  assert.ok(stats.investigations.CBC.recorded>=1);
  assert.ok(stats.investigations.EF.average>0);
  assert.ok(stats.dialysis.scheduled>=1);
  const inactive=(await req(`/api/patients/${patient.id}`,admin,"PATCH",{treatmentStatus:"Temporarily inactive"})).patient;
  assert.equal(inactive.treatmentStatus,"Temporarily inactive");
  const cancelled=(await req("/api/sessions",doctor)).sessions.find(s=>s.id===session.id);
  assert.equal(cancelled.status,"cancelled");
  assert.equal(cancelled.importantNote,`${run} observation`);
  await req("/api/sessions",admin,"POST",{patientId:patient.id,machineId:machine.id,unitId:"U1",date:day,slot:"Slot 2"},409);
  await req(`/api/machines/${machine.id}`,admin,"PATCH",{status:"maintenance",notes:`${run} maintenance`});
  const alerts=(await req("/api/notifications",doctor)).notifications.filter(n=>n.detail?.includes(run));
  assert.ok(alerts.some(n=>n.patient_id===patient.id&&n.record_id===patient.id));
  assert.ok(alerts.some(n=>n.record_id===machine.id));
  const alert=alerts[0];
  await req(`/api/notifications/${alert.id}`,doctor,"PATCH",{read:true});
  assert.equal((await req("/api/notifications",doctor)).notifications.find(n=>n.id===alert.id).read,true);
  const audits=(await req("/api/audit-logs",admin)).auditLogs;
  const change=audits.find(a=>a.entity_id===patient.id&&a.metadata.after?.treatmentStatus==="Temporarily inactive");
  assert.equal(change.metadata.before.treatmentStatus,"Active");
  assert.equal(change.metadata.actorRole,"admin");
  assert.ok(audits.some(a=>a.entity_id===note.id&&a.metadata.before?.body==="Original assessment"));
  await verifySavedNotesInBrowser(account.email,password,patient,note.id,newDoctor);
  await req(`/api/users/${account.id}`,admin,"PATCH",{status:"Inactive"});
  await req("/api/auth/me",newDoctor,"GET",undefined,401);
  await login("doctor",account.email,password,401);
  console.log("staff persistence, lifecycle, accounts, notes, notifications and analytics tests passed");
} finally {
  try {
    const sessions=ids.patients.length?(await db.query("SELECT id FROM dialysis_sessions WHERE patient_id=ANY($1::text[])",[ids.patients])).rows.map(s=>s.id):[];
    await db.query("DELETE FROM audit_logs WHERE entity_id=ANY($1::text[]) OR actor_id=ANY($2::text[])",
      [[...ids.patients,...ids.machines,...ids.notes,...ids.users,...sessions],ids.users]);
    await db.query("DELETE FROM notifications WHERE detail LIKE $1 OR user_id=ANY($2::text[])",[`%${run}%`,ids.users]);
    await db.query("DELETE FROM clinical_notes WHERE id=ANY($1::text[])",[ids.notes]);
    await db.query("DELETE FROM dialysis_sessions WHERE patient_id=ANY($1::text[])",[ids.patients]);
    await db.query("DELETE FROM dialysis_machines WHERE id=ANY($1::text[])",[ids.machines]);
    await db.query("DELETE FROM patients WHERE id=ANY($1::text[])",[ids.patients]);
    await db.query("DELETE FROM portal_users WHERE id=ANY($1::text[])",[ids.users]);
  } finally {await db.end();}
}
