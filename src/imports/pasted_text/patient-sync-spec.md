Synchronize Patient Data & Prescriptions Between Administrator and Doctor Portals

Update the existing Dialysis Slot Manager application.

This is a shared data synchronization feature between the Administrator Portal and the Doctor Portal.

Do not redesign the application. Preserve the existing UI, colors, typography, layouts, navigation, and components.

Objective

Create a single shared patient record that is accessible by both the Administrator and Doctor portals.

Both portals should always display the same patient information, dialysis records, investigation reports, and prescriptions.

Any changes made by one authorized user should automatically be reflected in the other portal.

1. Synchronize Patient Information

Whenever an Administrator:

Registers a patient
Updates patient demographics
Updates medical information
Updates investigations
Updates dialysis history
Updates viral status
Updates dialysis status
Updates treatment information

the same information must automatically appear in the Doctor Portal.

Doctors should never see outdated patient information.

The Doctor Portal should always display the latest saved patient record.

2. Synchronize Investigation Reports

Every report entered by the Administrator should be visible to the Doctor.

Examples include:

Medical Information
Native Kidney Disease
Blood Group
Access
OPD/IPD
Comorbidities
Biopsy Status
Viral Status
Basic Investigations
CBC
Hb
TLC
PLT
Serum Ferritin
Serum Calcium
Thyroid Profile
T3
T4
TSH
2D Echo
EF
Serum Phosphorous
Renal Function Test
Urea
Serum Creatinine

These should appear exactly as entered by the Administrator.

3. Synchronize Dialysis Prescription

Whenever an Administrator creates or edits a Dialysis Prescription, it should automatically appear in the Doctor Portal.

Include all prescription fields such as:

Weekly Dialysis Sessions
Dialysis Days
Dialysis Slot
Duration
Dialyzer
Dry Weight
Blood Flow Rate
Dialysate Flow Rate
UF Goal
Anticoagulation
Access
Notes

Doctors should always see the latest prescription.

4. Doctor Can Edit Prescription

Doctors should have permission to edit the Dialysis Prescription.

Doctors should be able to update:

Weekly Sessions
Dialysis Days
Slot
Duration
Dry Weight
Dialyzer
Blood Flow Rate
Dialysate Flow Rate
UF Goal
Heparin/Anticoagulation
Notes

After clicking Save, the updated prescription should become the current prescription.

5. Reflect Doctor Changes in Administrator Portal

Whenever a Doctor edits a prescription,

the Administrator Portal should immediately display the updated prescription.

The Administrator should never continue seeing the old prescription.

Both portals should always display identical prescription data.

6. Administrator Notification

Whenever a Doctor changes a prescription,

generate a notification in the Administrator Portal.

Example notification:

Prescription Updated

Dr. John Smith updated the dialysis prescription for Patient Ravi Kumar.

Include:

Doctor Name
Patient Name
Date
Time

Clicking the notification should open that patient's prescription.

7. Maintain Prescription History

Do not overwrite previous prescriptions permanently.

Create a prescription history log.

Each saved prescription should include:

Version Number
Edited By
Role (Administrator or Doctor)
Date
Time
Summary of Changes

Example:

Version 1

Created by Administrator

08 Aug 2026

Version 2

Edited by Dr. Sharma

09 Aug 2026

Changed:

Duration
UF Goal
Blood Flow Rate

Version 3

Edited by Administrator

11 Aug 2026

Changed:

Dialysis Days

Display this history in chronological order.

8. Real-Time Synchronization

Both portals should always use the same patient database.

Avoid creating duplicate patient records.

Whenever data is saved:

Update the shared patient record.
Refresh the corresponding patient data in both portals.
Ensure the latest information is visible without requiring duplicate entry.
9. Access Permissions
Administrator

Can:

View patient information
Create patient records
Edit patient information
Create prescriptions
Edit prescriptions
View prescription history
View doctor modifications
Doctor

Can:

View patient information
View reports
View investigations
View dialysis history
View prescriptions
Edit prescriptions
View prescription history

Doctors must not be able to:

Delete patients
Delete prescription history
Edit administrator accounts
Manage machines
Manage users
10. Notification Center

Add a notification item in the Administrator Portal.

Notify the Administrator whenever:

A Doctor edits a prescription.
A Doctor saves a new prescription version.

Unread notifications should be visually highlighted.

Clicking a notification should navigate directly to the relevant patient's prescription.

11. Data Integrity

Use a single shared patient record for both portals.

Do not duplicate patient data.

All patient information, reports, investigations, dialysis history, prescriptions, and prescription history should reference the same patient profile.

Implement proper synchronization so both portals always display consistent information.

Important Requirements
Do not redesign any screens.
Do not change the Patient Portal.
Preserve all existing layouts and components.
Maintain existing styling and responsiveness.
Ensure that changes made by either the Administrator or Doctor are reflected consistently across both portals while respecting user permissions.
Keep a complete audit trail of all prescription changes with editor name, role, timestamp, and change summary.