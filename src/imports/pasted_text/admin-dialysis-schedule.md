Update ONLY the Administrator Portal of the existing Dialysis Slot Manager application.

Do not modify the Patient Portal or Doctor Portal.

Preserve the existing design system, colors, typography, navigation, cards, spacing, and components.

==================================================
1. ADD DIALYSIS FREQUENCY / RECURRING DAYS
==================================================

In:

Administrator Portal → Register Patient

add a new section for the patient's recurring dialysis schedule.

Section title:

"Dialysis Schedule"

This section should allow the Administrator to specify:

1. How many days per week the patient requires dialysis.
2. Which days of the week the patient should receive dialysis.

==================================================
2. NUMBER OF DIALYSIS DAYS
==================================================

Add a field:

"Dialysis Days Per Week"

Provide selectable options:

- 1 day
- 2 days
- 3 days
- 4 days
- 5 days
- 6 days
- 7 days

The Administrator must select how many days per week the patient is scheduled for dialysis.

==================================================
3. SELECT DAYS OF THE WEEK
==================================================

Add:

"Dialysis Days"

Provide selectable options:

- Monday
- Tuesday
- Wednesday
- Thursday
- Friday
- Saturday
- Sunday

Allow the Administrator to select multiple days.

The number of selected days must match the value selected in "Dialysis Days Per Week".

Example:

Dialysis Days Per Week:
[ 3 days ]

Dialysis Days:
☑ Monday
☑ Wednesday
☑ Friday
☐ Tuesday
☐ Thursday
☐ Saturday
☐ Sunday

If the Administrator selects "3 days", exactly 3 days must be selected.

Do not allow more than 3 days to be selected.

If the Administrator changes the frequency from 3 days to 2 days, require the Administrator to reduce the selected days to 2 before continuing.

==================================================
4. VALIDATION
==================================================

This field is required when registering a patient.

The Administrator cannot complete patient registration without selecting:

- Number of dialysis days per week
- Corresponding days of the week

Show a clear validation message if the number of selected days does not match the selected frequency.

Example:

"Please select exactly 3 dialysis days."

Do not register the patient until the schedule is valid.

==================================================
5. CONNECT RECURRING DAYS WITH THE PATIENT'S SLOT
==================================================

The selected dialysis days should be associated with the patient's dialysis slot assignment.

For example:

Patient:
John Doe

Dialysis Frequency:
3 days/week

Dialysis Days:
Monday, Wednesday, Friday

Slot:
8:00 AM – 12:00 PM

Machine:
Negative

Unit:
Unit 1

This means the patient's dialysis schedule should appear on Monday, Wednesday, and Friday.

Do not create separate unrelated appointments for the patient.

The recurring schedule should remain associated with the patient's registration and assigned slot.

==================================================
6. ADMINISTRATOR DASHBOARD — TODAY'S PATIENTS
==================================================

On the Administrator Portal Dashboard, add a section/card:

"Today's Dialysis Patients"

This section should automatically display the patients who are scheduled for dialysis on the current day.

Do NOT show all registered patients.

Only show patients whose recurring dialysis schedule includes today's day of the week AND who have an active dialysis schedule/slot.

For example:

If today is Monday, show patients scheduled for Monday.

If today is Tuesday, show patients scheduled for Tuesday.

==================================================
7. PATIENT INFORMATION IN TODAY'S LIST
==================================================

For each patient scheduled for today, display:

- Patient Name
- Patient ID (if available)
- Dialysis Time / Slot
- Unit
- Machine
- Slot Type (Normal / Emergency)
- Dialysis Status

Example:

TODAY'S DIALYSIS PATIENTS

┌─────────────────────────────────────────────┐
│ John Doe                                    │
│ Patient ID: P-001                           │
│ Time: 8:00 AM – 12:00 PM                   │
│ Unit: Unit 1                                │
│ Machine: Negative                           │
│ Status: Scheduled                           │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Jane Smith                                  │
│ Patient ID: P-002                           │
│ Time: 12:00 PM – 4:00 PM                   │
│ Unit: Unit 2                                │
│ Machine: HCV                                │
│ Status: In Progress                         │
└─────────────────────────────────────────────┘

==================================================
8. TODAY'S PATIENT STATUS
==================================================

The Administrator should be able to clearly see the current status of each patient's dialysis session.

Use the existing status system if one already exists.

Possible statuses:

- Scheduled
- In Progress
- Completed
- Missed
- Cancelled

Do not create duplicate status systems if the application already has one.

The status should update according to the existing dialysis workflow.

==================================================
9. DASHBOARD FILTER / VIEW
==================================================

Add a date indicator above the list:

"Today's Dialysis Patients"

[ Today's Date ]

The list should automatically update based on the current date/day.

Optionally provide a date selector so the Administrator can view:

- Today's patients
- Another specific date

If a date selector is added, changing the date should show patients scheduled for that selected date according to their recurring dialysis days.

==================================================
10. EMPTY STATE
==================================================

If no patients are scheduled for dialysis on the selected day, display:

"No dialysis patients scheduled for this day."

Do not display an empty card or placeholder patient data.

==================================================
11. IMPORTANT — EXISTING SLOT ASSIGNMENT
==================================================

This new recurring schedule functionality must work together with the existing slot assignment system.

The Administrator should still be able to assign:

- Unit 1 or Unit 2
- Machine
- Normal Slot
- Emergency Slot
- Dialysis time

Do not remove or replace the existing machine and slot assignment functionality.

For Normal Slot, retain:

- 8:00 AM – 12:00 PM
- 12:00 PM – 4:00 PM
- 4:00 PM – 8:00 PM

For Emergency Slot, retain the existing option to select the specific dialysis time.

==================================================
12. EDIT PATIENT
==================================================

When the Administrator edits an existing patient, allow them to modify:

- Dialysis Days Per Week
- Dialysis Days
- Existing slot information

Changes should be reflected automatically in the Administrator Dashboard.

==================================================
13. PATIENT LIFECYCLE
==================================================

Only active dialysis patients should appear in "Today's Dialysis Patients".

Do not show patients who have been:

- Transplanted / dialysis ended
- Deactivated
- Permanently removed from dialysis
- Otherwise marked inactive

Use the existing patient status/lifecycle functionality if already implemented.

==================================================
14. DESIGN REQUIREMENTS
==================================================

Keep the existing Administrator Portal design.

The new "Dialysis Schedule" section should fit naturally into the existing Register Patient form.

Use:

- Existing card style
- Existing input components
- Existing checkbox/multi-select style
- Existing buttons
- Existing typography
- Existing spacing
- Existing color system

For the Dashboard, make "Today's Dialysis Patients" visually prominent because it is one of the most important daily operational sections.

Make the patient list easy for an Administrator to scan quickly.

==================================================
15. IMPORTANT
==================================================

Do NOT modify:

- Patient Portal
- Doctor Portal
- Doctor permissions
- Existing patient medical information
- Machine management
- Unit 1 / Unit 2 configuration
- Existing normal slot options
- Existing emergency slot functionality
- Existing patient history

Only add the recurring dialysis-day functionality and the Administrator Dashboard's daily patient view.

Make the feature work as an integrated part of the existing application rather than creating a separate scheduling system.