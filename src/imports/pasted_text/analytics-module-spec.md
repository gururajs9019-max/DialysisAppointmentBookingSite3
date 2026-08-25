FIGMA PROMPT — ADD ANALYTICS MODULE TO ADMINISTRATOR AND DOCTOR PORTALS

Update the existing Dialysis Slot Manager application.

Add a new "Analytics" section to BOTH:

1. Administrator Portal
2. Doctor Portal

Do not modify the Patient Portal.

Do not redesign the existing application. Preserve the existing colors, typography, navigation style, cards, charts, spacing, components, and responsive behavior.

The Analytics module should use the existing patient, dialysis, machine, prescription, clinical investigation, viral status, and patient outcome data already stored in the application.

Do NOT create fake or hardcoded analytics data.

==================================================
1. ANALYTICS NAVIGATION
==================================================

Add:

Analytics

to both the Administrator Portal and Doctor Portal navigation.

Clicking Analytics should open the Analytics Dashboard.

The Analytics Dashboard should contain exactly these six analytics categories:

1. Clinical Investigation
2. Viral Status
3. Prescription
4. Dialysis
5. Patient Outcomes
6. Machine Utilization

Do not add other analytics categories at this stage.

==================================================
2. COMMON ANALYTICS CONTROLS
==================================================

At the top of the Analytics page, provide:

Date Range:
- Today
- This Week
- This Month
- Last 3 Months
- This Year
- Custom Range

For the Administrator Portal, also provide:

Unit:
- All Units
- Unit 1
- Unit 2

The selected filters should update the analytics displayed below.

For the Doctor Portal, use the same analytics interface, but only show data that the logged-in doctor is authorized to access according to the existing permissions.

==================================================
3. CLINICAL INVESTIGATION ANALYTICS
==================================================

Create a Clinical Investigation Analytics section.

At the top of this section, provide a DROPDOWN.

Dropdown label:

"Select Clinical Investigation"

Dropdown options:

- All Clinical Investigations
- CBC
- Serum Ferritin
- Serum Calcium
- Thyroid Profile
- 2D Echo
- EF
- Serum Phosphorous
- Renal Function Test

The default selection should be:

"All Clinical Investigations"

IMPORTANT:
When the administrator/doctor selects a particular investigation, display analytics ONLY for that selected investigation.

Do not show all investigation charts simultaneously when a specific investigation is selected.

--------------------------------------------------
CBC
--------------------------------------------------

When "CBC" is selected, show:

- Hb
- TLC
- PLT

If the current database only stores whether these investigations are recorded/available, show:

- Number of patients with CBC recorded
- Percentage of patients with CBC recorded
- Number pending/not recorded

Do not invent laboratory values if actual values are not stored.

--------------------------------------------------
SERUM FERRITIN
--------------------------------------------------

Show:

- Yes
- No
- Total recorded
- Percentage recorded

--------------------------------------------------
SERUM CALCIUM
--------------------------------------------------

Show:

- Yes
- No
- Total recorded
- Percentage recorded

--------------------------------------------------
THYROID PROFILE
--------------------------------------------------

Show:

- T3
- T4
- TSH

Display recorded/completed status based on the actual stored data.

--------------------------------------------------
2D ECHO
--------------------------------------------------

Show:

- Yes
- No
- Total recorded
- Percentage recorded

--------------------------------------------------
EF
--------------------------------------------------

Show:

- Number of patients with EF recorded
- Average EF
- Minimum EF
- Maximum EF

Display EF as a percentage.

Only calculate these values from actual numeric EF data stored in the database.

--------------------------------------------------
SERUM PHOSPHOROUS
--------------------------------------------------

Show:

- Yes
- No
- Total recorded
- Percentage recorded

--------------------------------------------------
RENAL FUNCTION TEST
--------------------------------------------------

Show:

- Urea
- Serum Creatinine

Display recorded/completed status using the actual stored information.

==================================================
4. VIRAL STATUS ANALYTICS
==================================================

Create a Viral Status Analytics section.

Show distribution of registered patients by viral status:

- Negative
- HBsAg
- HCV
- HIV
- RVD (HIV), if this status exists in the existing patient data

Show:

- Total patients
- Number of patients in each status
- Percentage of total patients

Use a clear chart such as a donut chart or bar chart.

Also provide a table:

Viral Status | Patient Count | Percentage

Do not expose unnecessary patient-identifying information in the analytics chart.

==================================================
5. PRESCRIPTION ANALYTICS
==================================================

Create a Prescription Analytics section.

Use the existing dialysis prescription data.

Show:

### Weekly Dialysis Sessions

Distribution of patients by:

- 1 session/week
- 2 sessions/week
- 3 sessions/week
- 4 sessions/week
- 5 sessions/week
- 6 sessions/week
- 7 sessions/week

### Dialysis Days

Show the number of patients scheduled on:

- Monday
- Tuesday
- Wednesday
- Thursday
- Friday
- Saturday
- Sunday

### Dialysis Duration

Show:

- 2 hours
- 3 hours
- 4 hours
- 5 hours

### Slot Distribution

Show:

- 8 AM – 12 PM
- 12 PM – 4 PM
- 4 PM – 8 PM

Use charts and summary cards.

Do not include medication analytics at this stage.

==================================================
6. DIALYSIS ANALYTICS
==================================================

Create a dedicated Dialysis Analytics section.

IMPORTANT:

This section should contain ONLY dialysis/session-related analytics.

Do not mix machine maintenance, patient outcomes, prescription, viral status, or clinical investigation analytics into this section.

Show:

### Dialysis Sessions

- Total scheduled
- Completed
- Ongoing
- Waiting
- Missed
- Cancelled

### Current Dialysis

- Patients currently undergoing dialysis
- Patients waiting
- Available dialysis slots

### Dialysis Trend

Show dialysis session counts over the selected date range.

Allow:

- Daily
- Weekly
- Monthly

view.

### Slot Utilization

Show utilization for:

- 8 AM – 12 PM
- 12 PM – 4 PM
- 4 PM – 8 PM

### Average Dialysis Sessions

Show:

- Average sessions per day
- Average sessions per week
- Average sessions per month

Use actual database data.

==================================================
7. PATIENT OUTCOMES ANALYTICS
==================================================

Create a Patient Outcomes section.

Show patient lifecycle/outcome categories already supported by the application:

- Active
- Transplanted
- Transferred to another dialysis center
- Deceased
- Inactive

Show:

- Total patients
- Count for each outcome
- Percentage for each outcome

Also show an outcome trend over the selected date range.

Example:

Patient Outcomes
----------------
Active          245
Transplanted     12
Transferred       8
Deceased          15
Inactive          10

Do not use hardcoded numbers.

Use actual patient records.

==================================================
8. MACHINE UTILIZATION ANALYTICS
==================================================

Create a Machine Utilization section.

Show:

- Total machines
- Available
- Currently in use
- Under maintenance
- Disabled

Show machine utilization percentage.

==================================================
UNIT-WISE MACHINE ANALYTICS
==================================================

For Administrator Portal, provide:

Unit filter:

- All Units
- Unit 1
- Unit 2

Show machine utilization separately for:

Unit 1
- Total machines
- In use
- Available
- Maintenance
- Disabled

Unit 2
- Total machines
- In use
- Available
- Maintenance
- Disabled

==================================================
MACHINE TYPE ANALYTICS
==================================================

Show utilization by machine type:

- Negative
- HCV
- HBsAg
- HIV
- RVD (HIV)

Use only machine types that actually exist in the database.

Show:

Machine Type | Total | In Use | Available | Maintenance | Utilization %

==================================================
9. MACHINE UTILIZATION BY SLOT
==================================================

Show machine utilization for:

- 8 AM – 12 PM
- 12 PM – 4 PM
- 4 PM – 8 PM

This should help administrators and doctors understand when machines are most heavily utilized.

==================================================
10. DOCTOR PORTAL ANALYTICS
==================================================

The same six Analytics categories should be available in the Doctor Portal:

- Clinical Investigation
- Viral Status
- Prescription
- Dialysis
- Patient Outcomes
- Machine Utilization

However, respect existing doctor permissions.

A doctor should only see patient/clinical data that the doctor is authorized to access.

Do not give doctors Administrator-level management permissions through Analytics.

Analytics should be READ-ONLY.

Doctors should NOT be able to:

- Add patients from Analytics
- Delete patients
- Delete machines
- Modify machine configuration
- Modify patient outcomes
- Modify clinical investigations
- Modify prescriptions from the Analytics page

Prescription editing should continue to happen through the existing prescription workflow.

==================================================
11. ADMINISTRATOR PORTAL ANALYTICS
==================================================

Administrators can view the same six analytics categories.

Analytics should remain READ-ONLY.

Existing administrative functions such as:

- Patient registration
- Machine management
- Prescription management
- Patient status management

should continue to be performed through their existing pages.

Do not move these functions into Analytics.

==================================================
12. DATA ACCURACY
==================================================

This is extremely important.

Do not create dummy numbers.

All analytics must be calculated from the existing database.

Examples:

If there are 100 registered patients and 20 have HCV status:

HCV:
20 patients
20%

Do not display randomly generated numbers.

If there is no data:

Display:

"No data available"

or:

"0"

Do not display fake charts.

==================================================
13. ANALYTICS UI

Use a professional hospital dashboard design.

At the top:

Analytics

[Date Range] [Unit]

Then six category tabs/cards:

[Clinical Investigation]
[Viral Status]
[Prescription]
[Dialysis]
[Patient Outcomes]
[Machine Utilization]

Clicking a category should display its analytics.

For Clinical Investigation specifically:

[Select Clinical Investigation ▼]

Default:

All Clinical Investigations

When the user selects:

CBC

replace the current analytics content with CBC analytics.

When the user selects:

EF

replace the current analytics content with EF analytics.

The same behavior should apply to every investigation.

==================================================
14. RESPONSIVE DESIGN
==================================================

Make the Analytics page responsive for:

- Desktop
- Tablet

Charts should resize properly.

Tables should remain readable.

Dropdowns should not overflow the screen.

==================================================
15. IMPORTANT IMPLEMENTATION RULES
==================================================

Before implementing:

1. Inspect the existing database/schema.
2. Identify the existing patient records.
3. Identify existing clinical investigation data.
4. Identify viral status data.
5. Identify dialysis prescription data.
6. Identify dialysis session/schedule data.
7. Identify patient outcome/status data.
8. Identify machine and machine status data.

Reuse the existing database.

DO NOT create duplicate patient, prescription, machine, or session tables if they already exist.

DO NOT modify existing patient data.

DO NOT modify existing prescription data.

DO NOT modify the Patient Portal.

DO NOT redesign existing Doctor or Administrator Portal pages.

Only add the Analytics module and required navigation item.

==================================================
FINAL VALIDATION
==================================================

After implementing, verify:

1. Administrator can open Analytics.
2. Doctor can open Analytics.
3. Both portals show the six requested analytics categories.
4. Clinical Investigation has a working dropdown.
5. Selecting a specific investigation changes the displayed analytics.
6. Viral Status analytics use real patient data.
7. Prescription analytics use real prescription data.
8. Dialysis analytics use real dialysis session data.
9. Patient Outcomes use real patient status data.
10. Machine Utilization uses real machine data.
11. Unit 1 and Unit 2 filtering works for administrators.
12. Date range filtering works.
13. No fake/hardcoded analytics values are used.
14. Analytics pages are read-only.
15. Existing portal functionality remains unchanged.