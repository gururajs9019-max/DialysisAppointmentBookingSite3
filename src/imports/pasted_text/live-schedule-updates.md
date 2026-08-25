Figma Prompt – Live Schedule Vitals, Complications, Treatment Status & Prescription Updates

Update the existing Dialysis Slot Manager application.

IMPORTANT:
Modify the existing functionality in place. Do not rebuild the application or redesign existing pages.

The application has three portals:
- Administrator Portal
- Doctor Portal
- Patient Portal

For this update, make the requested changes to the Administrator Portal and the existing Doctor Portal Prescription functionality only.

Do not modify unrelated functionality in the Patient Portal.

Preserve the existing design system, colors, typography, cards, navigation, spacing, responsive behavior, and components.

==================================================
1. ADMIN PORTAL → LIVE SCHEDULE
==================================================

After an administrator assigns a patient to a dialysis machine and dialysis slot, that patient should automatically appear in:

Administrator Portal → Live Schedule

The Live Schedule should show the patients assigned for the CURRENT DAY.

Each patient should appear as a patient/session card.

Each card should show the existing relevant information, such as:

- Patient Name
- UHID / Patient ID
- Dialysis Unit
- Machine Number
- Machine Type
- Dialysis Time Slot
- Current Dialysis Status

Use the actual assignment and scheduling data from the existing database.

Do not use hardcoded patients.

==================================================
2. OPEN PATIENT CARD → VITALS
==================================================

When the administrator clicks a patient card in the Live Schedule, open the patient's dialysis session details.

Add a section:

"Vitals"

The Vitals section should contain two NUMBER INPUT fields:

1. Blood Pressure (BP)
2. Heart Rate

Example:

Vitals

Blood Pressure (BP)
[ __________ ]

Heart Rate
[ __________ ]

Both fields must:

- Accept numeric input.
- Be editable.
- Be individually clearable.
- Use the existing input styling.
- Not cause the page to jump or scroll unexpectedly when typing.
- Be saved against the PARTICULAR dialysis session, not just the patient's general profile.

IMPORTANT:

Vitals entered for today's dialysis session must belong to that specific dialysis session.

Do not overwrite the patient's previous dialysis session vitals.

==================================================
3. CURRENTLY RUNNING AND COMPLETED PATIENTS
==================================================

In Live Schedule, patients may have different statuses.

For patients whose dialysis is:

- Currently Running
- Completed Today

clicking their patient card should open the session details.

For both statuses, display the previously entered vitals.

Example:

Vitals

Blood Pressure (BP)
128
[Edit]

Heart Rate
76
[Edit]

If the administrator has already entered vitals, load those saved values automatically.

Do not show empty fields if values have already been saved.

Allow the administrator to edit previously entered vitals.

==================================================
4. ADD "COMPLICATION" SECTION
==================================================

For patients whose dialysis is currently running or has been completed that day, add a new section below Vitals:

"Complication"

Use ONE input/dropdown field.

When the administrator clicks the field, open a selectable list containing:

- Chills
- Cramps
- Hypotension
- Breathlessness
- Hypoglycemia
- Convulsions
- Bleeding Tendency
- Requiring Admission
- NIV Support
- Requiring Mechanical Intubation
- Death

IMPORTANT:

Allow MULTIPLE complications to be selected for the same dialysis session.

Example:

Complication
[ Hypotension, Cramps ▼ ]

The administrator should be able to:

- Select one complication.
- Select multiple complications.
- Remove/deselect an already selected complication.
- Clear all selected complications.

Do not use separate text fields for each complication.

Store the selected complications against the PARTICULAR dialysis session.

==================================================
5. IMPORTANT NOTE
==================================================

Immediately below the Complication section, add:

"Important Note"

Use a multiline text input/textarea.

Example:

Important Note

[____________________________________]
[____________________________________]
[____________________________________]

Allow the administrator to enter free-text clinical/session notes.

The Important Note must be saved against the particular dialysis session.

It must remain visible when reopening that session.

==================================================
6. LIVE SCHEDULE SESSION DETAILS LAYOUT
==================================================

When a patient card is opened, organize the information approximately as:

Patient Information
- Patient Name
- UHID
- Dialysis Unit
- Machine
- Time Slot
- Session Status

Vitals
- Blood Pressure (BP)
- Heart Rate

Complication
- Multi-select complication field

Important Note
- Multiline text field

Use the existing design style.

Do not create a completely new page if the current Live Schedule already has a patient/session details interaction.

A modal, drawer, expandable card, or existing detail panel can be used depending on the current design.

==================================================
7. TREATMENT STATUS → SEARCH
==================================================

In:

Administrator Portal → Treatment Status

Add a search bar.

The administrator must be able to search patients using BOTH:

- Patient Name
- UHID

The search should work using either value.

Example:

Search by patient name or UHID
[ 🔍 Search ]

If the administrator types:

"Rahul"

show matching patient(s).

If the administrator types:

"UHID12345"

show the corresponding patient.

Search should update the results dynamically.

Do not require separate search boxes for Name and UHID.

==================================================
8. TREATMENT STATUS → PRESCRIPTION FEATURES
==================================================

There is an existing page in the Doctor Portal called:

"Prescription"

Copy the EXISTING Prescription page functionality and UI behavior into:

Administrator Portal → Treatment Status

IMPORTANT:

Do not create a simplified version.

The Treatment Status Prescription section should have the same features currently available in the Doctor Portal Prescription page.

First inspect the existing Doctor Portal → Prescription page and reuse its existing components, fields, controls, layout, and functionality.

The administrator should be able to perform the same prescription-related actions available to the doctor, subject to existing administrator permissions.

Do not break the Doctor Portal Prescription page.

==================================================
9. DOCTOR PORTAL → EDIT PRESCRIPTION BUG
==================================================

In the Doctor Portal, there is currently an "Edit Prescription" function that is not working.

Fix it.

When a doctor clicks:

"Edit Prescription"

the existing prescription should open in editable mode.

The doctor should be able to modify the prescription fields.

The doctor should be able to:

- Change existing values.
- Add values where supported.
- Remove/clear values where supported.
- Save the updated prescription.
- Cancel editing without saving.

After saving, the updated prescription should be displayed correctly.

==================================================
10. DIALYSIS PRESCRIPTION MUST BE EDITABLE
==================================================

There is also a dialysis prescription that is currently not editable.

Make the dialysis prescription editable in BOTH:

- Doctor Portal
- Administrator Portal → Treatment Status

Use the existing prescription fields and design.

Do not create duplicate prescription structures.

Reuse the same underlying prescription data.

==================================================
11. PRESCRIPTION HISTORY
==================================================

IMPORTANT:

When an existing prescription is edited, DO NOT overwrite the only historical record.

Before saving the updated prescription:

1. Preserve the previous prescription as a historical version.
2. Save the new prescription as the current/latest prescription.
3. Store the previous prescription in the patient's history.

The Administrator Portal:

Patient History

should show previous prescription versions.

Example:

Prescription History

Current Prescription
Updated: 13 Aug 2026

Previous Prescription
Updated: 10 Aug 2026

Previous Prescription
Updated: 05 Aug 2026

When a previous prescription is opened, display the values that existed at that time.

==================================================
12. PRESCRIPTION HISTORY INFORMATION
==================================================

Each prescription history entry should ideally show:

- Prescription version/date
- Doctor who created/edited it
- Date and time of modification
- Prescription details
- Previous/current status

Do not delete historical prescriptions when a new prescription is saved.

Historical prescriptions should be read-only.

Only the current prescription should be editable.

==================================================
13. DATA SAFETY
==================================================

Vitals, complications, important notes, and prescriptions are clinical records.

Make sure they are stored against the correct patient and, where applicable, the correct dialysis session.

Do not store today's vitals in a way that overwrites previous dialysis session vitals.

Do not overwrite historical prescriptions.

Do not delete previous prescription versions.

Use the existing database/backend structure where possible.

Do not create duplicate patient records.

==================================================
14. PERMISSIONS
==================================================

Maintain the existing role permissions.

Administrator:
- Can view today's Live Schedule.
- Can enter/edit session vitals.
- Can enter/edit complications.
- Can add/edit Important Notes.
- Can search patients in Treatment Status.
- Can access prescription functionality in Treatment Status according to administrator permissions.

Doctor:
- Can access existing Prescription page.
- Can edit prescriptions.
- Can edit dialysis prescriptions.
- Changes must create prescription history.

Patient:
- Do not change the Patient Portal functionality as part of this update.

==================================================
15. IMPORTANT UI/UX REQUIREMENTS
==================================================

Use the existing application design.

Do not redesign unrelated screens.

Use:
- Existing cards
- Existing input components
- Existing buttons
- Existing dropdown/multi-select components
- Existing typography
- Existing spacing
- Existing colors

The Live Schedule should remain easy to scan.

Patient cards should clearly communicate:

- Scheduled
- Running
- Completed

Use the application's existing status indicators.

==================================================
16. FINAL VALIDATION
==================================================

After implementing the changes, test the following workflows:

TEST 1:
Admin assigns Patient A to a machine and today's slot.

Result:
Patient A appears in today's Live Schedule.

TEST 2:
Admin clicks Patient A.

Result:
Vitals section appears with:
- BP
- Heart Rate

TEST 3:
Admin enters BP and Heart Rate and saves.

Close and reopen the patient card.

Result:
Previously saved values are still displayed.

TEST 4:
Select multiple complications.

Example:
- Cramps
- Hypotension

Save.

Reopen the session.

Result:
Both complications remain selected and can be individually removed.

TEST 5:
Enter Important Note.

Save and reopen.

Result:
The note remains available.

TEST 6:
Search Treatment Status using Patient Name.

Result:
Correct patient appears.

TEST 7:
Search Treatment Status using UHID.

Result:
Correct patient appears.

TEST 8:
Open Treatment Status → Prescription.

Result:
It has the same prescription features as the existing Doctor Portal → Prescription page.

TEST 9:
Doctor opens an existing prescription and clicks Edit.

Result:
Prescription becomes editable and can be saved.

TEST 10:
Edit an existing prescription.

Result:
Previous prescription is preserved in Patient History and the new prescription becomes the current prescription.

TEST 11:
Edit dialysis prescription from Doctor Portal.

Result:
Changes save successfully.

TEST 12:
Edit dialysis prescription from Administrator Portal → Treatment Status.

Result:
Changes save successfully.

==================================================
FINAL IMPORTANT INSTRUCTION
==================================================

Do NOT rebuild existing pages.

Inspect the current implementation first and extend it.

Reuse existing Prescription components and data structures wherever possible.

Do not hardcode patient data, vitals, complications, schedules, or prescriptions.

Do not affect the Patient Portal.

Do not break existing Administrator Portal or Doctor Portal functionality.

Only implement the requested Live Schedule, Treatment Status, and Prescription changes.