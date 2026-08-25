/*
 * Development-only schema and synthetic seed setup. This is the post-merge
 * development hook; it is never imported by the HTTP server or deployment.
 */
import { Pool } from "pg";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
if (process.env.NODE_ENV === "production") {
  throw new Error("server/dev-schema.mjs is restricted to development databases.");
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = pbkdf2Sync(password, salt, 210_000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

const schemaSql = await readFile(new URL("./schema/001_dialysis_core.sql", import.meta.url), "utf8");
const seedSql = `
-- Synthetic demo seed. All writes use DO NOTHING, so a rerun never overwrites
-- changes made through the application.
INSERT INTO dialysis_units(id,name) VALUES ('U1','Unit 1'),('U2','Unit 2') ON CONFLICT(id) DO NOTHING;
INSERT INTO dialysis_machines(id,unit_id,code,name,category,status)
SELECT 'M'||lpad(n::text,2,'0'),'U1','M'||lpad(n::text,2,'0'),'Machine '||lpad(n::text,2,'0'),
  CASE WHEN n<=22 THEN 'Negative' WHEN n<=27 THEN 'HCV' WHEN n=28 THEN 'HBsAg' ELSE 'RVD (HIV)' END,
  CASE WHEN n=5 THEN 'maintenance' WHEN n=7 THEN 'disabled' ELSE 'available' END
FROM generate_series(1,29) n ON CONFLICT(id) DO NOTHING;
INSERT INTO dialysis_machines(id,unit_id,code,name,category,status)
SELECT 'U2M'||lpad(n::text,2,'0'),'U2','U2M'||lpad(n::text,2,'0'),'U2-Machine '||lpad(n::text,2,'0'),
  CASE WHEN n<=5 THEN 'Negative' WHEN n=6 THEN 'HCV' ELSE 'HIV' END,'available'
FROM generate_series(1,7) n ON CONFLICT(id) DO NOTHING;
INSERT INTO patients(id,uhid,data,viral_category,lifecycle) VALUES
('P001','KMCRI-DEMO-001','{"name":"Arjun Mehta","gender":"Male","age":45,"primaryDisease":"Chronic Kidney Disease Stage 5","viralStatus":{"hepatitisB":"Negative","hepatitisC":"Negative","hiv":"Negative"}}','Negative','Active'),
('P002','KMCRI-DEMO-002','{"name":"Lakshmi Iyer","gender":"Female","age":52,"primaryDisease":"End Stage Renal Disease","viralStatus":{"hepatitisB":"Positive","hepatitisC":"Negative","hiv":"Negative"}}','HBsAg','Active'),
('P003','KMCRI-DEMO-003','{"name":"Vikram Singh","gender":"Male","age":38,"primaryDisease":"Polycystic Kidney Disease","viralStatus":{"hepatitisB":"Negative","hepatitisC":"Positive","hiv":"Negative"}}','HCV','Active'),
('P004','KMCRI-DEMO-004','{"name":"Priya Reddy","gender":"Female","age":48,"primaryDisease":"Glomerulonephritis","viralStatus":{"hepatitisB":"Negative","hepatitisC":"Negative","hiv":"Unknown"}}','Negative','Active')
ON CONFLICT(id) DO NOTHING;
INSERT INTO notifications(id,type,message,detail) VALUES
('DEMO-N001','warning','Machine M05 under maintenance','Synthetic development notification.'),
('DEMO-N002','info','Demo data loaded','Unit 1 and Unit 2 sample resources are available.')
ON CONFLICT(id) DO NOTHING;
`;

try {
  await pool.query(schemaSql);
  await pool.query(seedSql);
  // Configured staff identities are intentionally seeded only when credentials
  // are supplied by the environment. Existing accounts (including changed
  // names, roles, and passwords) are never updated by development setup.
  const accounts = [
    ["admin1", "admin1@kmcri.test", "Priya Sharma", "admin", process.env.STAFF_ADMIN_PASSWORD],
    ["doctor1", "doctor@kmcri.test", "Dr. Rajesh Verma", "doctor", process.env.STAFF_DOCTOR_PASSWORD],
  ];
  for (const [username, email, name, role, password] of accounts) {
    if (typeof password === "string" && password.length >= 12) {
      await pool.query(
        `INSERT INTO portal_users(id,username,email,name,role,password_hash)
         VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(email) DO NOTHING`,
        [randomBytes(16).toString("hex"), username, email, name, role, hashPassword(password)],
      );
    }
  }
  // These dependent seeds are harmless if they were inserted earlier, and now
  // reliably populate after configured staff has been created.
  await pool.query(`
    INSERT INTO dialysis_sessions(id,patient_id,machine_id,unit_id,session_date,slot,status,data,created_by)
    SELECT 'DEMO-S001','P001','M01','U1',current_date,'Slot 1','scheduled',
      '{"duration":"4 Hours","notes":"Synthetic demo session"}',u.id FROM portal_users u
    WHERE u.role IN ('doctor','admin') LIMIT 1 ON CONFLICT(id) DO NOTHING;
    INSERT INTO prescriptions(id,patient_id,data,created_by)
    SELECT 'DEMO-RX001','P001','{"diagnosis":"CKD Stage 5","status":"Active","dialysisRx":{"weeklySessionsCount":"3 Sessions / Week","duration":"4 Hours"},"medications":[{"name":"Erythropoietin alfa","dose":"4000 IU","frequency":"Per session","route":"SC"}],"notes":"Synthetic demo prescription."}',u.id
    FROM portal_users u WHERE u.role IN ('doctor','admin') LIMIT 1 ON CONFLICT(id) DO NOTHING;
    INSERT INTO clinical_notes(id,patient_id,body,author_id)
    SELECT 'DEMO-CN001','P001','Synthetic demo note: session plan reviewed.',u.id FROM portal_users u
    WHERE u.role IN ('doctor','admin') LIMIT 1 ON CONFLICT(id) DO NOTHING;
  `);
  console.log("Development schema is ready.");
} finally {
  await pool.end();
}