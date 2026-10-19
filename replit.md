# Dialysis Appointment Booking Site

## Run locally

Install dependencies with `npm install`, then start the Vite development server:

```bash
npm run dev -- --host 0.0.0.0 --port 5000
```

The Replit preview uses the `Start application` workflow with this command.

## Build

```bash
npm run build
```

## Managed PostgreSQL schema

`server/schema/001_dialysis_core.sql` is the versioned schema source. `npm run
db:setup` applies it and idempotent synthetic seeds to the development database
only; task merge invokes this through `scripts/post-merge.sh`.

Replit Publish automatically diffs the development schema against production
and applies the resulting schema changes. Publish or re-publish after merging a
schema change. The application does not run schema DDL at startup or in
production deployment code.

## Approved two-step publishing migration

The schema is currently prepared for **Publish phase 1**: the
`prescriptions_id_patient` UNIQUE constraint is present, while the development
`session_patient_prescription` foreign key is temporarily removed with the
user's approval. API validation of patient/prescription ownership remains active.

Do not restore that foreign key until the user confirms the first publish
succeeded, or read-only production catalog queries confirm the referenced
UNIQUE constraint is present there. Then replace the phase-1 constraint removal
in the schema source with repeatable creation of the composite foreign key,
restore the corresponding database-integrity assertions in both schema and staff
backend tests, apply the development schema, and recompute the Publish diff for
the second publish.

Never truncate prescription data or add deployment/startup DDL to bypass this
sequence. Both production schema changes must go through Publish.