Add Doctor Management functionality to the existing Dialysis Slot Manager application.

IMPORTANT:
Modify ONLY the Administrator Portal for this change.
Do not modify the Patient Portal or Doctor Portal UI/functionality.
Do not disturb existing patient, dialysis scheduling, machine, or authentication functionality.

==================================================
1. ADD "DOCTORS" MANAGEMENT TO ADMIN PORTAL
==================================================

In the Administrator Portal, add a new navigation item/sub-portal:

"Doctors"

Place it in the appropriate section of the existing Admin Portal navigation, using the same design style as the existing navigation items such as Patients, Machines, etc.

The Doctors page should allow the administrator to view and manage all registered doctors.

==================================================
2. DOCTOR LIST
==================================================

Create a Doctors management page showing a table/list of registered doctors.

Display useful information such as:

- Doctor Name
- Doctor ID / User ID
- Email
- Phone Number (if available)
- Specialization
- Status
- Date Added
- Actions

Use the existing database data where available.

Do not use fake/hardcoded doctors.

==================================================
3. ADD DOCTOR
==================================================

Give the administrator an "Add Doctor" button.

When clicked, open a form/modal to create a new doctor.

The form should include:

Required:
- Full Name
- Email
- Password
- Specialization

Optional:
- Phone Number
- Doctor ID / Employee ID, if supported by the existing system

For Specialization, allow the administrator to enter/select the doctor's specialization.

For example:
- Nephrology

Validate all required fields before creating the account.

Validate:
- Name cannot be empty.
- Email must be valid.
- Password must meet the application's existing password requirements.
- Prevent duplicate doctor accounts using the same email.

==================================================
4. CREATE DOCTOR LOGIN ACCOUNT
==================================================

When the administrator creates a doctor:

- Create the doctor's authentication account using the existing authentication system.
- Create the corresponding doctor profile/record in the database.
- Assign the correct "doctor" role.
- Do NOT allow the administrator to accidentally create the account with an admin role.
- The new doctor must be able to log into the existing Doctor Portal using the credentials created by the administrator.
- Do not create a separate authentication system.

After successful creation, show:

"Doctor added successfully."

Then refresh the Doctors list.

==================================================
5. DELETE DOCTOR
==================================================

Give the administrator an option to delete a doctor.

Each doctor row should have an Actions menu/button containing:

"Delete Doctor"

Before deletion, show a confirmation dialog:

"Are you sure you want to delete this doctor?"

Clearly display the doctor's name/email in the confirmation.

Buttons:

- Cancel
- Delete Doctor

Do not delete the doctor immediately without confirmation.

==================================================
6. IMPORTANT DATA SAFETY
==================================================

Deleting a doctor should NOT delete:

- Patients
- Patient medical history
- Dialysis sessions
- Dialysis schedules
- Machine information
- Other doctors
- Administrator accounts

If the doctor has existing patients, dialysis schedules, notes, or historical records, DO NOT cascade-delete those records.

Instead, handle existing relationships safely according to the existing database design.

Prefer deactivating/disabling the doctor's account if permanent deletion would break historical records.

Historical records should continue to show the doctor's name/identity where required.

==================================================
7. DOCTOR STATUS
==================================================

Add a Status field for doctors:

- Active
- Inactive

Display the status clearly in the Doctors list.

If the existing authentication/database structure supports it, allow the administrator to deactivate a doctor instead of permanently deleting the account.

An inactive doctor should not be able to log into the Doctor Portal.

==================================================
8. SECURITY / PERMISSIONS
==================================================

This is very important.

Only authorized Administrator users should be able to:

- View the Doctors management page.
- Add doctors.
- Delete/deactivate doctors.
- Change doctor status.

Do NOT allow:
- Doctors to add/delete other doctors.
- Patients to add/delete doctors.
- Regular users to access doctor management.

Enforce this authorization on the BACKEND/database level, not only by hiding the UI.

Do not rely only on frontend checks.

Prevent an administrator from accidentally changing a doctor's role to "admin" through the Add Doctor form.

==================================================
9. UI/UX
==================================================

Match the existing Administrator Portal design.

Use:
- Existing colors
- Existing typography
- Existing buttons
- Existing cards
- Existing table styles
- Existing modal/dialog styles

Make the Doctors page responsive for desktop and tablet.

Add:
- Search doctors
- Filter by Active/Inactive status
- Clear empty state when there are no doctors

Example empty state:

"No doctors registered yet."

with:

"+ Add Doctor"

button.

==================================================
10. IMPORTANT EXISTING APP SAFETY
==================================================

Before implementing this feature, inspect the existing authentication and database structure.

Reuse the existing:
- Authentication system
- User/role system
- Doctor profile structure
- Database conventions
- Permission/RLS policies

Do NOT create duplicate user or role tables if they already exist.

Do NOT modify the Patient Portal.

Do NOT modify the Doctor Portal design.

Do NOT modify existing dialysis scheduling functionality.

Do NOT delete existing data.

After implementation, test:

1. Admin can open Doctors.
2. Admin can add a doctor.
3. New doctor receives the correct doctor role.
4. New doctor can log into Doctor Portal.
5. Doctor cannot access Admin Doctor Management.
6. Admin can deactivate a doctor.
7. Inactive doctor cannot log in.
8. Admin can delete/deactivate a doctor safely.
9. Existing patient and dialysis records remain intact.
10. Administrator and Patient accounts remain unaffected.