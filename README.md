
  # Dialysis Appointment Booking Site

  This is a code bundle for Dialysis Appointment Booking Site. The original project is available at https://www.figma.com/design/uEHRg0TsdKuLkpCowya4M4/Dialysis-Appointment-Booking-Site.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

## Staff backend

Administrator scheduling uses the active doctor directory and offers the
selected patient's non-discontinued prescriptions. Explicit assignments are
validated by the API and retained through database relationships. Unassigned
and historical sessions remain valid; old names are not automatically converted
into guessed clinical assignments.

Live Schedule supports **Call Patient → Called → Start Treatment**. Called
sessions continue to reserve the machine and patient slot. Patient deactivation
cancels future scheduled, waiting, and called sessions without deleting history.

Patient, unit, and machine creation commit together with their audit entries.
If the audit write fails, creation rolls back.

### Development database and tests

```bash
npm run db:setup       # Repeatable development schema and synthetic seeds
npm run build
npm run test:backend
npm run test:production # Local production-mode server, not the published app
```

Development seeding preserves existing records and prescription history. An
unchanged demo prescription receives its initial history snapshot; an edited
prescription is never used to fabricate an earlier snapshot.

Patient Portal changes are outside this work.
  