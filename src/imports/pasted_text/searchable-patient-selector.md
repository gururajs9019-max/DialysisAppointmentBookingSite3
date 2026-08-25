FIGMA PROMPT — SEARCHABLE PATIENT SELECTOR IN DOCTOR NOTES

Update only the existing:

Doctor Portal
→ Notes
→ New Clinical Note

Do not redesign the Notes page or modify any other Doctor Portal, Administrator Portal, or Patient Portal functionality.

==================================================
CURRENT ISSUE
==================================================

When the doctor clicks the:

"Select Patient"

field while creating a new clinical note, the application currently displays a large list of patients.

I want this changed to a SEARCHABLE PATIENT SELECTOR.

==================================================
REQUIRED BEHAVIOR
==================================================

Replace the current patient selection behavior with a searchable autocomplete/dropdown.

The field should initially display:

"Select Patient"

When the doctor clicks the field, they should be able to type the patient's name.

Example:

Select Patient
[ Ravi                 ]

As the doctor types:

"R"

show matching patients.

If the doctor types:

"Ra"

reduce the results to patients whose names match "Ra".

If the doctor types:

"Ravi"

show only patients whose names match "Ravi".

The patient options should dynamically filter as the doctor types.

==================================================
SEARCH MATCHING
==================================================

Search should be case-insensitive.

For example:

Searching:
"ravi"

should also match:

"Ravi Kumar"

Searching:
"RAVI"

should produce the same results.

The search should match the patient's name progressively as the doctor types.

Example:

Input:
"ku"

Possible result:

Ravi Kumar
Anil Kumar
Suresh Kumar

If there are no matching patients, display:

"No patients found"

instead of showing the complete patient list.

==================================================
PATIENT OPTION DESIGN
==================================================

Each matching patient option should clearly display:

- Patient Name
- Patient ID / UHID, if available

Example:

Ravi Kumar
UHID: P00125

This helps the doctor distinguish between patients with similar names.

==================================================
SELECTION BEHAVIOR
==================================================

When the doctor clicks a patient from the filtered results:

- Select that patient.
- Close the dropdown.
- Display the selected patient's name in the field.
- Store the patient's actual unique ID internally.
- Do NOT store only the patient's name as the relationship.

Example:

Selected Patient:
Ravi Kumar

The clinical note must be linked to Ravi Kumar's actual patient record/unique patient ID.

==================================================
EDITING THE SEARCH
==================================================

After selecting a patient, the doctor should still be able to change the selected patient.

Provide either:

- A clear/remove icon, or
- Allow the doctor to click the field and search for another patient.

When the selection is cleared:

The field should return to:

"Select Patient"

and the doctor can search again.

==================================================
PERFORMANCE
==================================================

Do not load/display an unnecessarily large patient list every time the field is opened.

Filter the existing patient data efficiently.

If the application supports backend search, use it appropriately.

The search should remain responsive even when there are hundreds or thousands of registered patients.

If backend search is not currently available, implement efficient client-side filtering using the existing patient data.

==================================================
ACCESS CONTROL
==================================================

Only show patients that the logged-in doctor is authorized to access according to the existing Doctor Portal permissions.

Do not expose unauthorized patient records through the search.

Do not change existing doctor permissions.

==================================================
FORM VALIDATION
==================================================

A clinical note should NOT be saved unless a patient has been selected.

If the doctor attempts to save without selecting a patient, display:

"Please select a patient."

Highlight the patient selector appropriately.

==================================================
IMPORTANT UI REQUIREMENTS
==================================================

Keep the existing:

- Notes page layout
- New Clinical Note modal/page
- Colors
- Typography
- Buttons
- Form fields
- Spacing
- Icons

Only change the "Select Patient" component into a searchable autocomplete/dropdown.

Do not create a separate patient search page.

==================================================
EXAMPLE FINAL EXPERIENCE
==================================================

Doctor opens:

Doctor Portal
→ Notes
→ New Clinical Note

Patient field:

[ Select Patient ▼ ]

Doctor clicks it and types:

[ Ravi ]

Dropdown immediately filters:

--------------------------------
Ravi Kumar
UHID: P00125

Ravi Shankar
UHID: P00148
--------------------------------

Doctor selects:

Ravi Kumar

The field becomes:

[ Ravi Kumar ✓ ]

The doctor can then enter the clinical note normally.

==================================================
FINAL TESTING
==================================================

Test the following:

1. Open New Clinical Note.
2. Click Select Patient.
3. Confirm the doctor can type into the field.
4. Type one character and verify the field does NOT lose focus.
5. Type multiple characters continuously.
6. Verify results reduce according to the entered patient name.
7. Verify search is case-insensitive.
8. Verify "No patients found" appears when there are no matches.
9. Select a patient.
10. Verify the patient's name appears in the field.
11. Verify the clinical note is linked to the correct patient ID.
12. Clear the selection and search for another patient.
13. Verify the doctor cannot save a note without selecting a patient.
14. Verify unauthorized patients are not exposed.
15. Verify the rest of the Notes page remains unchanged.