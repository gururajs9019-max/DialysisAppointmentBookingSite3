import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("Schema compatibility test requires DATABASE_URL.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
const temporarySchema = `dialysis_schema_test_${randomUUID().replaceAll("-", "")}`;
const quotedSchema = `"${temporarySchema}"`;
const schemaSql = await readFile(new URL("./schema/001_dialysis_core.sql", import.meta.url), "utf8");
const expectedTables = [
  "audit_logs",
  "clinical_notes",
  "dialysis_appointments",
  "dialysis_machines",
  "dialysis_sessions",
  "dialysis_units",
  "notifications",
  "patients",
  "portal_users",
  "prescription_versions",
  "prescriptions",
];

try {
  await client.query(`CREATE SCHEMA ${quotedSchema}`);
  await client.query(`SET search_path TO ${quotedSchema}`);

  // Simulate the database state that predates the dialysis backend expansion.
  await client.query(`
    CREATE TABLE dialysis_appointments (
      id text PRIMARY KEY,
      data jsonb NOT NULL,
      status text NOT NULL CHECK (status IN ('upcoming', 'completed', 'cancelled')),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE portal_users (
      id text PRIMARY KEY,
      username text UNIQUE,
      email text UNIQUE NOT NULL,
      name text NOT NULL,
      role text NOT NULL CHECK (role IN ('doctor', 'admin')),
      password_hash text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  // Reproduce the earlier development schema: a standalone unique index
  // already supports the FK, but Publish did not carry that index to prod.
  const attachUnique = "ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_id_patient\n      UNIQUE USING INDEX prescriptions_id_patient;";
  assert.ok(schemaSql.includes(attachUnique));
  await client.query(schemaSql.replace(attachUnique, "NULL;"));
  const originalIndex = (await client.query(`SELECT indexrelid FROM pg_index
    WHERE indexrelid='prescriptions_id_patient'::regclass`)).rows[0].indexrelid;
  // Applying twice preserves the referenced index and restores the composite
  // FK after the prerequisite UNIQUE constraint is added.
  await client.query(schemaSql);
  await client.query(schemaSql);
  const uniqueKey = (await client.query(`SELECT contype,convalidated,conindid,pg_get_constraintdef(oid) definition
    FROM pg_constraint WHERE conrelid='prescriptions'::regclass AND conname='prescriptions_id_patient'`)).rows[0];
  assert.equal(uniqueKey.contype, "u");
  assert.equal(uniqueKey.convalidated, true);
  assert.equal(uniqueKey.conindid, originalIndex, "upgrading preserves the existing unique index");
  assert.equal(uniqueKey.definition, "UNIQUE (id, patient_id)");
  const sessionLink = (await client.query(`SELECT contype,convalidated,pg_get_constraintdef(oid) definition
    FROM pg_constraint WHERE conrelid='dialysis_sessions'::regclass AND conname='session_patient_prescription'`)).rows[0];
  assert.equal(sessionLink.contype, "f");
  assert.equal(sessionLink.convalidated, true);
  assert.equal(sessionLink.definition,
    "FOREIGN KEY (prescription_id, patient_id) REFERENCES prescriptions(id, patient_id)");

  const tables = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname=$1 ORDER BY tablename",
    [temporarySchema],
  );
  assert.deepEqual(tables.rows.map(row => row.tablename), expectedTables);

  const indexes = await client.query(
    `SELECT indexname FROM pg_indexes
     WHERE schemaname=$1 AND indexname = ANY($2::text[])
     ORDER BY indexname`,
    [temporarySchema, ["active_machine_slot", "active_patient_slot"]],
  );
  assert.deepEqual(
    indexes.rows.map(row => row.indexname),
    ["active_machine_slot", "active_patient_slot"],
  );
  const historySeed = await readFile(new URL("./seeds/prescription-history.sql", import.meta.url), "utf8");
  await client.query(`
    INSERT INTO portal_users(id,email,name,role,password_hash) VALUES('seed-author','seed@example.test','Synthetic author','doctor','not-a-login');
    INSERT INTO patients(id,uhid,data,viral_category) VALUES('seed-patient','SYNTHETIC-SEED','{}','Negative');
    INSERT INTO prescriptions(id,patient_id,data,created_by)
      VALUES('DEMO-RX001','seed-patient','{"diagnosis":"Synthetic original"}','seed-author');
  `);
  await client.query(historySeed);
  await client.query(historySeed);
  const original = (await client.query("SELECT version,snapshot,changed_by FROM prescription_versions")).rows;
  assert.deepEqual(original, [{ version:1, snapshot:{ diagnosis:"Synthetic original" }, changed_by:"seed-author" }]);
  await client.query(`UPDATE prescriptions SET version=2,data='{"diagnosis":"Synthetic edited"}' WHERE id='DEMO-RX001'`);
  await client.query(historySeed);
  assert.deepEqual((await client.query("SELECT version,snapshot,changed_by FROM prescription_versions")).rows, original,
    "reseeding never overwrites history with the edited prescription");
  await client.query("DELETE FROM prescription_versions WHERE prescription_id='DEMO-RX001'");
  await client.query(historySeed);
  assert.equal((await client.query("SELECT count(*)::int count FROM prescription_versions")).rows[0].count, 0,
    "a missing historical snapshot cannot be fabricated from an edited demo");
  console.log("schema compatibility and idempotent prescription seed tests passed");
} finally {
  try {
    await client.query("SET search_path TO public");
    await client.query(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`);
  } finally {
    client.release();
    await pool.end();
  }
}