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

  // Applying twice proves both legacy compatibility and idempotence.
  await client.query(schemaSql);
  await client.query(schemaSql);

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
  console.log("schema compatibility tests passed");
} finally {
  try {
    await client.query("SET search_path TO public");
    await client.query(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`);
  } finally {
    client.release();
    await pool.end();
  }
}