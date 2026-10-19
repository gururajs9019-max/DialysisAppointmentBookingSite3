import { randomUUID } from "node:crypto";
import { investigationStats, investigationPaths } from "../shared/clinical-data.mjs";

export function staffServices(ctx) {
  const mergeRecords=(old,patch)=>{
    const result={...old};
    for(const [key,value] of Object.entries(patch)) {
      result[key]=value&&typeof value==="object"&&!Array.isArray(value)
        ?mergeRecords(old?.[key]&&typeof old[key]==="object"?old[key]:{},value):value;
    }
    return result;
  };
  const { pool, requireStaff, readJson, object, text, httpError, sendJson, transaction,
    audit, notifyRole, hashPassword, validatePatient, patientDto, fetchPatient, recalculateMachineAvailability, requiredViralCategory, dateKey } = ctx;
  const safeUser = u => ({ id: u.id, username: u.username, email: u.email, name: u.name,
    role: u.role, status: u.status, ...u.profile, dateAdded: u.created_at, updatedAt: u.updated_at,
    hasHistoricalRecords: Boolean(u.has_history) });
  const historySql = `EXISTS(SELECT 1 FROM audit_logs a WHERE a.actor_id=u.id)
    OR EXISTS(SELECT 1 FROM dialysis_sessions s WHERE s.created_by=u.id OR s.doctor_id=u.id OR s.data->>'doctor'=u.name)
    OR EXISTS(SELECT 1 FROM prescriptions p WHERE p.created_by=u.id)
    OR EXISTS(SELECT 1 FROM clinical_notes n WHERE n.author_id=u.id)`;
  return async (req, res, url) => {
    const path = url.pathname, parts = path.split("/").filter(Boolean);
    if (path === "/api/scheduling-options" && req.method === "GET") {
      await requireStaff(req);
      const patientId = url.searchParams.get("patientId");
      const [doctors, prescriptions] = await Promise.all([
        pool.query("SELECT id,name FROM portal_users WHERE role='doctor' AND status='Active' ORDER BY name,id"),
        pool.query("SELECT id,version,data->>'diagnosis' diagnosis FROM prescriptions WHERE patient_id=$1 AND status<>'Discontinued' ORDER BY updated_at DESC,id", [patientId]),
      ]);
      sendJson(res,200,{doctors:doctors.rows,prescriptions:prescriptions.rows}); return true;
    }
    if (path === "/api/users" && req.method === "GET") {
      await requireStaff(req, "admin");
      const r = await pool.query(`SELECT u.*,(${historySql}) has_history FROM portal_users u ORDER BY name`);
      sendJson(res, 200, { users: r.rows.map(safeUser) }); return true;
    }
    if (path === "/api/users" && req.method === "POST") {
      const actor = await requireStaff(req, "admin"), x = object(await readJson(req));
      if (!["admin","doctor"].includes(x.role)) throw httpError(400, "Invalid staff role.");
      const password = text(x.password, "password", { required: true, max: 512 });
      if (password.length < 12) throw httpError(400, "Password must be at least 12 characters.");
      const email = text(x.email, "email", { required: true, max: 320 }).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, "Invalid email.");
      try {
        const user = await transaction(async c => {
          const r = await c.query(`INSERT INTO portal_users(id,username,email,name,role,password_hash,profile)
            VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [randomUUID(), x.username || null, email,
            text(x.name,"name",{required:true}),x.role,hashPassword(password),
            { specialization: x.specialization || "", phone: x.phone || "", employeeId: x.employeeId || "" }]);
          await audit(c,actor,"user.create","user",r.rows[0].id,{ after: safeUser(r.rows[0]) });
          return safeUser(r.rows[0]);
        });
        sendJson(res,201,{user}); return true;
      } catch(e) { if(e.code==="23505") throw httpError(409,"Username or email already exists."); throw e; }
    }
    if (parts[0]==="api" && parts[1]==="users" && parts.length===3 && ["PATCH","DELETE"].includes(req.method)) {
      const actor=await requireStaff(req,"admin"), id=decodeURIComponent(parts[2]);
      const x=req.method==="DELETE"?{status:"Inactive"}:object(await readJson(req));
      if (x.status && !["Active","Inactive"].includes(x.status)) throw httpError(400,"Invalid staff status.");
      const user=await transaction(async c=>{
        const old=(await c.query("SELECT * FROM portal_users WHERE id=$1 FOR UPDATE",[id])).rows[0];
        if(!old) throw httpError(404,"Staff account was not found.");
        if(actor.id===id && x.status==="Inactive") throw httpError(409,"You cannot deactivate your own account.");
        const profile={...old.profile};
        for(const key of ["phone","employeeId","specialization"]) if(key in x) profile[key]=text(x[key],key);
        const email="email" in x?text(x.email,"email",{required:true,max:320}).toLowerCase():old.email;
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400,"Invalid email.");
        let passwordHash=old.password_hash;
        if(x.password) {
          const password=text(x.password,"password",{required:true,max:512});
          if(password.length<12) throw httpError(400,"Password must be at least 12 characters.");
          passwordHash=hashPassword(password);
        }
        const r=await c.query("UPDATE portal_users SET name=$2,status=$3,profile=$4,email=$5,password_hash=$6,updated_at=now() WHERE id=$1 RETURNING *",
          [id,"name" in x?text(x.name,"name",{required:true}):old.name,x.status||old.status,profile,email,passwordHash]);
        await audit(c,actor,"user.update","user",id,{before:safeUser(old),after:safeUser(r.rows[0])});
        return safeUser(r.rows[0]);
      });
      sendJson(res,200,{user}); return true;
    }
    if(parts[1]==="patients" && parts.length===3 && req.method==="PATCH") {
      const actor=await requireStaff(req,"admin"), id=decodeURIComponent(parts[2]), values=validatePatient(await readJson(req),true);
      const patient=await transaction(async c=>{
        await c.query("SELECT id FROM patients WHERE id=$1 FOR UPDATE",[id]);
        const old=await fetchPatient(c,id), lifecycle=values.treatmentStatus||old.lifecycle;
        const data={...old.data,...values};
        for(const key of ["medicalInfo","investigations","registrationFields","viralStatus"]) {
          if(values[key]) data[key]=mergeRecords(old.data[key],values[key]);
        }
        const r=await c.query("UPDATE patients SET uhid=$2,data=$3,viral_category=$4,lifecycle=$5,updated_at=now() WHERE id=$1 RETURNING *",
          [id,values.uhid||old.uhid,data,requiredViralCategory(data.viralStatus),lifecycle]);
        if(lifecycle!=="Active") {
          const ended=await c.query(`UPDATE dialysis_sessions SET status='cancelled',
            data=data || '{"status":"cancelled","attendance":"Cancelled"}'::jsonb,updated_at=now()
            WHERE patient_id=$1 AND session_date>=CURRENT_DATE AND status IN ('scheduled','waiting','called')
            RETURNING id,machine_id`,[id]);
          for(const s of ended.rows) {
            await recalculateMachineAvailability(c,s.machine_id);
            await audit(c,actor,"session.cancel.lifecycle","session",s.id,{patientId:id,lifecycle});
          }
        }
        await audit(c,actor,"patient.update","patient",id,{before:patientDto(old),after:patientDto(r.rows[0])});
        await notifyRole(c,actor,"doctor","info",lifecycle!==old.lifecycle?"Patient status changed":"Clinical information updated",
          `${data.name} (${old.uhid}): ${lifecycle}.`,{patientId:id,recordId:id});
        return patientDto(r.rows[0]);
      });
      sendJson(res,200,{patient}); return true;
    }
    if(parts[1]==="machines" && parts.length===3 && req.method==="PATCH") {
      const actor=await requireStaff(req,"admin"), id=decodeURIComponent(parts[2]), x=object(await readJson(req));
      if(x.status && !["available","in-use","scheduled","maintenance","disabled"].includes(x.status)) throw httpError(400,"Invalid machine status.");
      const machine=await transaction(async c=>{
        const old=(await c.query("SELECT * FROM dialysis_machines WHERE id=$1 FOR UPDATE",[id])).rows[0];
        if(!old) throw httpError(404,"Machine was not found.");
        const r=await c.query("UPDATE dialysis_machines SET name=$2,status=$3,notes=$4,updated_at=now() WHERE id=$1 RETURNING *",
          [id,"name" in x?text(x.name,"name",{required:true}):old.name,x.status||old.status,"notes" in x?text(x.notes,"notes"):old.notes]);
        await audit(c,actor,"machine.update","machine",id,{before:old,after:r.rows[0]});
        await notifyRole(c,actor,"doctor","info","Machine status changed",`${old.code}: ${r.rows[0].status}.`,{recordId:id});
        return r.rows[0];
      });
      sendJson(res,200,{machine}); return true;
    }
    if((path==="/api/clinical-notes" && ["POST","GET"].includes(req.method)) ||
      (parts[1]==="clinical-notes" && parts.length===3 && req.method==="PATCH")) {
      const actor=await requireStaff(req);
      if(req.method==="GET") {
        const r=await pool.query(`SELECT n.*,u.name author_name FROM clinical_notes n JOIN portal_users u ON u.id=n.author_id ORDER BY n.created_at DESC`);
        sendJson(res,200,{notes:r.rows});return true;
      }
      const x=object(await readJson(req)), id=req.method==="POST"?randomUUID():decodeURIComponent(parts[2]);
      if("data" in x) object(x.data,"data");
      const note=await transaction(async c=>{
        const old=req.method==="PATCH"?(await c.query("SELECT * FROM clinical_notes WHERE id=$1 FOR UPDATE",[id])).rows[0]:null;
        if(req.method==="PATCH"&&!old) throw httpError(404,"Clinical note was not found.");
        if(old&&actor.role!=="admin"&&old.author_id!==actor.id) throw httpError(403,"Only the author or an administrator may edit this note.");
        if(old) {
          if(!Number.isSafeInteger(x.baseVersion)||x.baseVersion<1) throw httpError(400,"A positive integer baseVersion is required.");
          if(x.baseVersion!==old.version) {
            const error=httpError(409,"Another staff member saved a newer clinical note. Your draft has not been saved. Review the newer note before trying again.");
            error.code="CLINICAL_NOTE_VERSION_CONFLICT";
            error.currentVersion=old.version;
            throw error;
          }
        }
        const patient=await fetchPatient(c,old?.patient_id||text(x.patientId,"patientId",{required:true}));
        const body=text(x.body,"note",{required:true,max:10000});
        const data={...old?.data,...x.data};
        if(x.sessionId) {
          const linked=(await c.query("SELECT patient_id FROM dialysis_sessions WHERE id=$1",[text(x.sessionId,"sessionId",{required:true})])).rows[0];
          if(!linked||linked.patient_id!==patient.id) throw httpError(400,"Clinical-note session must belong to this patient.");
        }
        const r=old?await c.query("UPDATE clinical_notes SET body=$2,data=$3,version=version+1,updated_at=now() WHERE id=$1 RETURNING *",[id,body,data])
          :await c.query("INSERT INTO clinical_notes(id,patient_id,body,author_id,data,session_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",[id,patient.id,body,actor.id,data,x.sessionId||null]);
        await audit(c,actor,old?"note.update":"note.create","clinical_note",id,{before:old,after:r.rows[0]});
        await notifyRole(c,actor,actor.role==="doctor"?"admin":"doctor","info","Clinical note updated",
          `${patient.data.name} (${patient.uhid}) has new clinical information.`,{patientId:patient.id,recordId:id});
        return {...r.rows[0],author_name:old?undefined:actor.name};
      });
      sendJson(res,req.method==="POST"?201:200,{note});return true;
    }
    if(path==="/api/analytics" && req.method==="GET") {
      await requireStaff(req);
      const from=url.searchParams.get("from"),to=url.searchParams.get("to"),unit=url.searchParams.get("unit");
      for(const date of [from,to]) if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw httpError(400,"Invalid analytics date.");
      const [p,s,m,rx]=await Promise.all([pool.query("SELECT * FROM patients"),
        pool.query("SELECT * FROM dialysis_sessions WHERE ($1::date IS NULL OR session_date >= $1::date) AND ($2::date IS NULL OR session_date <= $2::date) AND ($3::text IS NULL OR unit_id=$3)",[from,to,unit==="all"?null:unit]),
        pool.query("SELECT * FROM dialysis_machines WHERE ($1::text IS NULL OR unit_id=$1)",[unit==="all"?null:unit]),
        pool.query("SELECT * FROM prescriptions")]);
      const patients=p.rows.map(patientDto);
      const group=(rows,key)=>rows.reduce((a,r)=>({...a,[r[key]]:(a[r[key]]||0)+1}),{});
      sendJson(res,200,{analytics:{
        patients:patients.length, active_patients:patients.filter(p=>p.treatmentStatus==="Active").length,
        available_machines:m.rows.filter(m=>m.status==="available").length,
        today_sessions:s.rows.filter(s=>dateKey(s.session_date)===dateKey(new Date())&&!["missed","cancelled"].includes(s.status)).length,
        missed_last_30_days:s.rows.filter(s=>s.status==="missed"&&new Date(s.session_date)>=new Date(Date.now()-30*86400000)).length,
        investigations:Object.fromEntries(Object.keys(investigationPaths).map(k=>[k,investigationStats(patients,k)])),
        viralStatus:group(p.rows,"viral_category"), outcomes:group(p.rows,"lifecycle"),
        dialysis:group(s.rows,"status"), machineUtilization:group(m.rows,"status"), prescriptions:group(rx.rows,"status"),
        missedReasons:group(s.rows.filter(s=>s.status==="missed").map(s=>({reason:s.data.missedReason||"Not recorded"})),"reason"),
        access:patients.reduce((a,p)=>{const key=p.medicalInfo?.dialysisAccess||"Not recorded";a[key]=(a[key]||0)+1;return a;},{}),
        comorbidities:patients.reduce((a,p)=>{for(const v of String(p.comorbidities||"").split(",").map(v=>v.trim()).filter(Boolean))a[v]=(a[v]||0)+1;return a;},{}),
      }});return true;
    }
    return false;
  };
}
