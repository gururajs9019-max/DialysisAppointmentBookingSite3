FIGMA PROMPT — PRESCRIPTION LAST UPDATED DATE, TIME & EDITOR

Update the existing Dialysis Slot Manager application.

Apply this change to the Dialysis Prescription display in BOTH:

1. Administrator Portal
2. Doctor Portal

Do not redesign the prescription section. Preserve the existing layout, styling, cards, fields, buttons, and workflows.

==================================================
1. SHOW LAST UPDATED INFORMATION
==================================================

After a prescription is saved, display a small metadata section directly BELOW the prescription.

Show:

Last Updated:
[Date] [Time]

Updated By:
[User Name] ([Role])

For example:

Last Updated: 21 Aug 2026, 01:35 PM
Updated By: Dr. Sharma (Doctor)

OR:

Last Updated: 21 Aug 2026, 02:10 PM
Updated By: Admin User (Administrator)

Use the existing application's date/time formatting style where possible.

==================================================
2. UPDATE EVERY TIME THE PRESCRIPTION IS SAVED
==================================================

Whenever an authorized user edits ANY prescription field and clicks:

"Save Changes"

update:

- Last Updated Date
- Last Updated Time
- Updated By
- Updated By Role

The timestamp must represent the actual time at which the prescription was successfully saved.

Do NOT update the timestamp merely when the user opens the Edit Prescription form.

Only update it after the changes are successfully saved.

==================================================
3. IDENTIFY WHO EDITED THE PRESCRIPTION
==================================================

The system must identify whether the latest prescription change was made by:

- Administrator
- Doctor

Display the role clearly.

Examples:

Updated By:
Dr. Rahul Kumar (Doctor)

or

Updated By:
Administrator (Administrator)

If the logged-in user's name is available, display the actual user's name.

Do NOT use hardcoded names.

Use the currently authenticated user's account information.

==================================================
4. SAME INFORMATION IN BOTH PORTALS
==================================================

The Administrator Portal and Doctor Portal must display the SAME latest prescription metadata.

Example:

Doctor edits prescription:

Last Updated:
21 Aug 2026, 03:25 PM

Updated By:
Dr. Rahul Kumar (Doctor)

This exact information should immediately appear in the Administrator Portal.

If the Administrator subsequently edits the prescription:

Last Updated:
21 Aug 2026, 04:10 PM

Updated By:
Administrator (Administrator)

This updated information should immediately appear in the Doctor Portal.

Both portals must always show the latest saved prescription information.

==================================================
5. PRESCRIPTION HISTORY
==================================================

Do not delete previous update information.

Maintain the existing prescription history functionality.

Every saved prescription version should record:

- Version
- Date
- Time
- Updated By
- Role
- Changes made

Example:

Prescription History

Version 3
21 Aug 2026, 04:10 PM
Updated By: Administrator (Administrator)

Changed:
- Dialysis Duration
- UF Goal

--------------------------------

Version 2
21 Aug 2026, 03:25 PM
Updated By: Dr. Rahul Kumar (Doctor)

Changed:
- Dialysis Days
- Dialysis Slot

--------------------------------

Version 1
20 Aug 2026, 10:15 AM
Created By: Administrator (Administrator)

This history must remain available even after subsequent edits.

==================================================
6. DO NOT OVERWRITE HISTORY
==================================================

The current prescription should show only the LATEST:

- Last Updated Date/Time
- Updated By
- Role

However, previous versions must remain available in Prescription History.

Do not replace or delete previous history when a new prescription is saved.

==================================================
7. SAVE VALIDATION
==================================================

The "Last Updated" information should only change after the backend/database confirms that the prescription was successfully saved.

If saving fails:

- Do not update Last Updated
- Do not change Updated By
- Show the existing save error
- Keep the previous prescription metadata

Do not display a false timestamp.

==================================================
8. REAL DATABASE DATA
==================================================

Do NOT hardcode:

- Date
- Time
- Doctor name
- Administrator name
- Role

Store and retrieve this information from the existing prescription/version/history data and authenticated user information.

Use the existing database/authentication system.

Do not create duplicate patient or prescription records.

==================================================
9. UI DESIGN
==================================================

Place the metadata directly below the existing prescription content.

Example:

-----------------------------------------
DIALYSIS PRESCRIPTION

Weekly Dialysis:
3 Sessions / Week

Dialysis Days:
Monday, Wednesday, Friday

Slot:
8 AM – 12 PM

Duration:
4 Hours

...existing prescription fields...

-----------------------------------------

Last Updated:
21 Aug 2026, 03:25 PM

Updated By:
Dr. Rahul Kumar (Doctor)

[Edit Prescription]
-----------------------------------------

Keep this information visually subtle but clearly readable.

Use the existing typography and design system.

==================================================
10. IMPORTANT SCOPE
==================================================

Do not modify:

- Patient Portal
- Patient registration
- Machine management
- Live Schedule
- Treatment Status
- Analytics
- Existing prescription fields

Only update the prescription display, save behavior, and prescription history metadata required for this feature.

==================================================
FINAL TEST

Test the following workflow:

1. Administrator opens a patient's prescription.
2. Administrator changes the prescription.
3. Administrator clicks Save.
4. Verify the current date/time appears below the prescription.
5. Verify "Updated By: [Administrator] (Administrator)" appears.
6. Open the same patient in Doctor Portal.
7. Verify the same date/time and administrator information appears.
8. Doctor edits the prescription.
9. Doctor saves the changes.
10. Verify the date/time updates.
11. Verify "Updated By: [Doctor Name] (Doctor)" appears.
12. Open the same patient in Administrator Portal.
13. Verify the doctor's latest update is displayed.
14. Verify the previous administrator version remains in Prescription History.
15. Verify no history is deleted or overwritten.