-- Dialysis service schema source, version 001.
-- Replit applies development schema changes to production through Publish.
-- This file is not executed by the application server at startup.

-- Legacy appointment and staff tables are retained for backwards compatibility.
CREATE TABLE IF NOT EXISTS dialysis_appointments (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('upcoming', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS portal_users (
  id text PRIMARY KEY,
  username text UNIQUE,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('doctor', 'admin')),
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dialysis_units (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dialysis_machines (
  id text PRIMARY KEY,
  unit_id text NOT NULL REFERENCES dialysis_units(id),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('Negative', 'HCV', 'HBsAg', 'HIV', 'RVD (HIV)')),
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in-use', 'scheduled', 'maintenance', 'disabled')),
  notes text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS patients (
  id text PRIMARY KEY,
  uhid text NOT NULL UNIQUE,
  data jsonb NOT NULL,
  viral_category text NOT NULL CHECK (viral_category IN ('Negative', 'HCV', 'HBsAg', 'HIV', 'Unknown')),
  lifecycle text NOT NULL DEFAULT 'Active' CHECK (lifecycle IN ('Active', 'Transplanted', 'Expired', 'Shifted', 'Discontinued')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dialysis_sessions (
  id text PRIMARY KEY,
  patient_id text NOT NULL REFERENCES patients(id),
  machine_id text NOT NULL REFERENCES dialysis_machines(id),
  unit_id text NOT NULL REFERENCES dialysis_units(id),
  session_date date NOT NULL,
  slot text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'waiting', 'running', 'completed', 'missed', 'cancelled')),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text NOT NULL REFERENCES portal_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS active_machine_slot
  ON dialysis_sessions(machine_id, session_date, slot)
  WHERE status NOT IN ('cancelled', 'missed');

CREATE UNIQUE INDEX IF NOT EXISTS active_patient_slot
  ON dialysis_sessions(patient_id, session_date, slot)
  WHERE status NOT IN ('cancelled', 'missed');

CREATE TABLE IF NOT EXISTS prescriptions (
  id text PRIMARY KEY,
  patient_id text NOT NULL REFERENCES patients(id),
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Revised', 'Discontinued')),
  data jsonb NOT NULL,
  created_by text NOT NULL REFERENCES portal_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prescription_versions (
  id text PRIMARY KEY,
  prescription_id text NOT NULL REFERENCES prescriptions(id),
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  changed_by text NOT NULL REFERENCES portal_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prescription_id, version)
);

CREATE TABLE IF NOT EXISTS clinical_notes (
  id text PRIMARY KEY,
  patient_id text NOT NULL REFERENCES patients(id),
  session_id text REFERENCES dialysis_sessions(id),
  body text NOT NULL,
  author_id text NOT NULL REFERENCES portal_users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id text PRIMARY KEY,
  user_id text REFERENCES portal_users(id),
  type text NOT NULL CHECK (type IN ('warning', 'info', 'error', 'success')),
  message text NOT NULL,
  detail text NOT NULL DEFAULT '',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id text PRIMARY KEY,
  actor_id text REFERENCES portal_users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Additive, repeatable staff-only extensions; historical records are retained.
ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Active';
ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS profile jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE clinical_notes ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE clinical_notes ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE clinical_notes ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1 CHECK (version > 0);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS patient_id text REFERENCES patients(id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS record_id text;
ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_lifecycle_check;
ALTER TABLE patients ADD CONSTRAINT patients_lifecycle_check CHECK
  (lifecycle IN ('Active','Transplanted','Expired','Shifted','Discontinued','Temporarily inactive','Transferred','Screening ended'));

-- Unassigned historical sessions remain valid. Explicit clinical links are
-- validated by the API throughout the staged Publish migration.
ALTER TABLE dialysis_sessions DROP CONSTRAINT IF EXISTS dialysis_sessions_status_check;
ALTER TABLE dialysis_sessions ADD CONSTRAINT dialysis_sessions_status_check CHECK
  (status IN ('scheduled','waiting','called','running','completed','missed','cancelled'));
ALTER TABLE dialysis_sessions ADD COLUMN IF NOT EXISTS doctor_id text REFERENCES portal_users(id);
ALTER TABLE dialysis_sessions ADD COLUMN IF NOT EXISTS prescription_id text;
CREATE UNIQUE INDEX IF NOT EXISTS prescriptions_id_patient ON prescriptions(id,patient_id);
DO $$ BEGIN
  -- Publish must carry the referenced key as a constraint, not just a
  -- standalone index. Reuse the existing index so linked history stays intact.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='prescriptions'::regclass
    AND conname='prescriptions_id_patient') THEN
    ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_id_patient
      UNIQUE USING INDEX prescriptions_id_patient;
  END IF;
END $$;

-- Publish phase 1: publish the referenced UNIQUE constraint before restoring
-- the composite FK in phase 2. This drops only the development FK when this
-- development-only schema setup is run; no records are deleted.
ALTER TABLE dialysis_sessions DROP CONSTRAINT IF EXISTS session_patient_prescription;