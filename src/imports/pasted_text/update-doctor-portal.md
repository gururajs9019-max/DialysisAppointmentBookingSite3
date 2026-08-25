Update ONLY the Doctor Portal of the existing Dialysis Slot Manager application.

Do not modify the Administrator Portal or Patient Portal. Preserve the existing Doctor Portal design, navigation, authentication, database structure, colors, typography, and overall layout unless specifically mentioned below.

I want the following three changes:

==================================================
1. REMOVE "CRITICAL ALERTS REQUIRE ATTENTION"
==================================================

On the Doctor Portal → Doctor Command Center/Home dashboard, there is currently a large red card:

"Critical Alerts Require Attention"

with:
- Emergency bookings and high-priority items need immediate review
- Review Now button

Remove this entire card from the Doctor Portal.

Do not replace it with another alert card.

After removing it, make sure the dashboard layout closes the empty space and remains visually balanced.

Do not remove the notification/bell icon from the top navigation unless it is specifically part of this alert card.

==================================================
2. REPLACE PLACEHOLDER TEXT IN DASHBOARD KPI CARDS
==================================================

The Doctor Command Center currently contains six KPI cards that display placeholder text such as:

- Scheduled → "Multiple sessions"
- Completed → "Many completed"
- Active Now → "Currently active"
- Pending → "Several pending"
- Alerts → "Some alerts"
- Machines → "Available"

These are not useful because they are not actual values.

Replace the placeholder text with REAL, DYNAMIC NUMBERS from the application's database/backend.

The six cards should be:

1. SCHEDULED
   Show the actual number of dialysis sessions scheduled for the relevant current day.

2. COMPLETED
   Show the actual number of dialysis sessions completed for the relevant current day.

3. ACTIVE NOW
   Show the actual number of dialysis sessions/patients currently undergoing dialysis.

4. PENDING
   Show the actual number of scheduled dialysis sessions that are still pending.

5. ALERTS
   Show the actual number of active/relevant alerts that require doctor attention.

6. MACHINES
   Show the actual number of currently available dialysis machines.

IMPORTANT:
- Do NOT use hardcoded numbers.
- Do NOT use placeholder words such as "Many", "Several", "Currently active", "Available", etc.
- Fetch the values from the existing backend/database.
- The numbers must automatically update when the underlying data changes.
- Use the existing dialysis schedules, patients, machines, and alert data already available in the application.
- If there is no data, display "0" rather than placeholder text.

Example:

Scheduled
12

Completed
8

Active Now
3

Pending
4

Alerts
1

Machines
10

Keep the existing card design and icons. Only replace the placeholder values with actual dynamic counts.

==================================================
3. REMOVE SLOT APPROVAL PAGE FROM DOCTOR PORTAL
==================================================

Remove the "Slot Approval" page/functionality from the Doctor Portal.

This means:

- Remove the Slot Approval item from the Doctor Portal navigation/sidebar/menu.
- Remove the Slot Approval page/route from the Doctor Portal.
- Remove any Doctor Portal buttons or links that navigate to Slot Approval.
- Doctor users should no longer be able to access Slot Approval through the UI.
- If someone manually enters the old Slot Approval URL, redirect them to the Doctor Portal Home/Dashboard instead of showing the page.

IMPORTANT:
Do not delete or modify the actual dialysis scheduling functionality used by the Administrator Portal.

The Administrator Portal must continue to manage and assign dialysis slots normally.

==================================================
DOCTOR PORTAL NAVIGATION AFTER UPDATE
==================================================

Keep the existing Doctor Portal navigation except for removing Slot Approval.

The Doctor Portal should continue to have the relevant existing sections such as:

- Home
- Dashboard
- Schedule
- Patients
- Machines
- Notes

Do not remove any of these unless they are already dependent on Slot Approval.

==================================================
DATA AND BACKEND REQUIREMENTS
==================================================

Before implementing the KPI numbers, inspect the existing database/schema and determine where the relevant schedule, dialysis session, patient, machine, and alert information is stored.

Do not create duplicate tables if the required data already exists.

Use the existing backend/database.

Calculate the KPI values correctly:

- Scheduled = sessions scheduled for the current day
- Completed = sessions whose status is completed for the current day
- Active Now = sessions currently in progress
- Pending = scheduled sessions that have not yet started/completed/cancelled
- Alerts = currently active alerts relevant to the doctor
- Machines = machines currently available for use

Make sure cancelled, missed, disabled, or maintenance sessions/machines are not incorrectly counted as active or available.

If the existing database uses different status names, inspect the actual status values and map them correctly instead of assuming status names.

==================================================
IMPORTANT SAFETY / SCOPE
==================================================

This is an existing multi-portal application.

DO NOT:
- Modify Administrator Portal
- Modify Patient Portal
- Change administrator permissions
- Change patient permissions
- Change doctor authentication
- Delete existing patient or dialysis data
- Change database tables unnecessarily
- Hardcode KPI values
- Rebuild the Doctor Portal from scratch

ONLY:
1. Remove the Critical Alerts Require Attention card.
2. Replace the six dashboard placeholder values with real dynamic numbers.
3. Remove Slot Approval from the Doctor Portal.

After making the changes, test the Doctor Portal to ensure:
- Dashboard loads correctly.
- KPI numbers display correctly.
- KPI numbers update when relevant data changes.
- No blank/large empty area remains where the alert card was.
- Slot Approval is no longer accessible from Doctor Portal navigation.
- Existing Schedule, Patients, Machines, and Notes pages still work.
- Administrator Portal and Patient Portal remain unchanged.