Update ONLY the Administrator Portal → Patient/Machine Slot Assignment flow of the existing Dialysis Slot Manager application.

Do NOT modify the Patient Portal or Doctor Portal.

Do NOT change the existing normal slot booking behavior except for adding the new Normal/Emergency selection described below.

==================================================
1. ADD SLOT TYPE SELECTION
==================================================

When an Administrator is assigning a new patient to a dialysis machine and reaches the "Select Slot" step, add a new field:

"Slot Type"

Provide exactly two options:

○ Normal Slot
○ Emergency Slot

The administrator must select one of these before proceeding.

Use the existing UI components, styling, colors, and layout.

==================================================
2. NORMAL SLOT
==================================================

If the Administrator selects:

"Normal Slot"

retain the existing normal dialysis slot selection exactly as it currently works.

The available time slots must be:

1. 8:00 AM – 12:00 PM
2. 12:00 PM – 4:00 PM
3. 4:00 PM – 8:00 PM

Display them as selectable options.

Example:

Slot Type
○ Normal Slot
○ Emergency Slot

Normal Dialysis Slot

○ 8:00 AM – 12:00 PM
○ 12:00 PM – 4:00 PM
○ 4:00 PM – 8:00 PM

The Administrator must select one of the three normal slots.

Do NOT add the old fourth slot.

==================================================
3. EMERGENCY SLOT
==================================================

If the Administrator selects:

"Emergency Slot"

do NOT display the three normal slot options.

Instead, display:

"Emergency Dialysis Time"

Allow the Administrator to select/enter the specific dialysis start time for the emergency dialysis session.

Use a time picker/input.

Example:

Slot Type
○ Normal Slot
● Emergency Slot

Emergency Dialysis Time
[ 10:30 AM ]

The Administrator should be able to select the required dialysis time rather than being restricted to the three normal time ranges.

==================================================
4. EMERGENCY TIME VALIDATION
==================================================

For an Emergency Slot:

- The dialysis time is required.
- Do not allow the Administrator to continue without selecting a time.
- Validate that a valid time has been entered/selected.
- Do not automatically convert an emergency slot into one of the normal 8 AM–12 PM, 12 PM–4 PM, or 4 PM–8 PM slots.
- Store the actual emergency dialysis time.

If the application already has operating hours for the dialysis center, use those existing hours to validate the emergency time.

Do not create arbitrary operating hours if they do not already exist.

==================================================
5. SLOT DATA
==================================================

When saving the assignment, store the slot type clearly.

For example:

Normal:
slot_type = "normal"
slot_time = "08:00 AM - 12:00 PM"

Emergency:
slot_type = "emergency"
emergency_time = "10:30 AM"

Use the existing database structure if it already supports this.

If a schema change is required, make the smallest possible change.

Do NOT create duplicate scheduling tables.

==================================================
6. MACHINE AVAILABILITY
==================================================

The existing machine assignment rules must continue to work for both:

- Normal Slot
- Emergency Slot

Before confirming the assignment, check that the selected machine is available at the requested time.

For emergency slots, check availability against the exact emergency dialysis time.

Do not allow two patients to be assigned to the same machine at overlapping times.

Continue respecting existing machine restrictions and machine status, including machines that are disabled/under maintenance.

==================================================
7. ASSIGNMENT SUMMARY
==================================================

Before the Administrator confirms the assignment, show a clear summary.

For Normal Slot:

Patient:
[Patient Name]

Unit:
[Unit 1 / Unit 2]

Machine:
[Machine Name]

Slot Type:
Normal Slot

Dialysis Slot:
8:00 AM – 12:00 PM

For Emergency Slot:

Patient:
[Patient Name]

Unit:
[Unit 1 / Unit 2]

Machine:
[Machine Name]

Slot Type:
Emergency Slot

Emergency Dialysis Time:
10:30 AM

Add the existing confirmation button.

==================================================
8. EDITING / CHANGING SLOT TYPE
==================================================

Allow the Administrator to switch between:

Normal Slot
and
Emergency Slot

before saving the assignment.

When switching:

Normal → Emergency:
- Hide the three normal slot options.
- Show the emergency time picker.
- Clear the previously selected normal slot if necessary.

Emergency → Normal:
- Hide the emergency time picker.
- Show the three normal slots.
- Clear the emergency time value.

Do not retain conflicting values from both slot types.

==================================================
9. DISPLAY AFTER ASSIGNMENT
==================================================

Wherever the assigned dialysis session is displayed in the Administrator Portal, clearly indicate whether it is:

"Normal"

or

"Emergency"

For emergency sessions, display the exact dialysis time.

Example:

Patient: John Doe
Machine: RVD [HIV]
Unit: Unit 1
Slot: Emergency
Time: 10:30 AM

For normal sessions:

Patient: John Doe
Machine: Negative
Unit: Unit 1
Slot: Normal
Time: 8:00 AM – 12:00 PM

==================================================
10. IMPORTANT — DO NOT BREAK EXISTING FUNCTIONALITY
==================================================

Do NOT modify:

- Patient Portal
- Doctor Portal
- Existing patient registration
- Patient medical information
- Machine management
- Unit 1 / Unit 2 structure
- Existing machine types
- Machine maintenance/disable functionality
- Existing normal slot booking logic
- Existing patient history
- Existing authentication

Only modify the Administrator Portal slot-assignment flow.

==================================================
11. FINAL TESTING
==================================================

Test all scenarios:

1. Select Normal Slot → three existing time slots appear.
2. Select 8 AM–12 PM → assignment works.
3. Select 12 PM–4 PM → assignment works.
4. Select 4 PM–8 PM → assignment works.
5. Select Emergency Slot → three normal slots disappear.
6. Emergency time picker appears.
7. Select an emergency time → assignment works.
8. Emergency time cannot be left empty.
9. Switching Normal → Emergency clears the normal slot.
10. Switching Emergency → Normal clears the emergency time.
11. Machine availability is checked for emergency time.
12. Existing machine/unit restrictions continue to work.
13. Saved appointments clearly show Normal or Emergency.
14. Existing normal bookings remain unchanged.
15. Patient Portal and Doctor Portal remain unaffected.

IMPORTANT:
Do not redesign the entire booking page. Make this a focused enhancement to the existing Administrator Portal slot-selection UI.