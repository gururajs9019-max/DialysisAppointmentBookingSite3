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