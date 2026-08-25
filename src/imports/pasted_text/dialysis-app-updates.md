FIGMA PROMPT — CBC MCV, MISSED SLOT "OTHER", AND NEW ANALYTICS

Update the existing Dialysis Slot Manager application.

Apply the changes below to the existing application without redesigning unrelated screens.

IMPORTANT:
- Do not modify the Patient Portal.
- Do not remove existing fields or analytics.
- Preserve the current design system, colors, typography, cards, spacing, navigation, and responsive behavior.
- Use the existing database/data structure wherever possible.
- Do not use hardcoded/fake analytics values.
- All analytics must be calculated from actual stored patient, investigation, prescription, missed-slot, and machine data.

==================================================
PART 1 — REGISTER PATIENT → MEDICAL INFORMATION → CBC
==================================================

In:

Administrator Portal
→ Register Patient
→ Medical Information
→ Basic Investigation
→ CBC

There are currently CBC parameters:

- Hb
- TLC
- PLT

Add one additional CBC parameter:

- MCV

The CBC section should now contain:

- Hb
- TLC
- PLT
- MCV

MCV must be a NUMERIC INPUT.

Example:

MCV
[ 85 ]

Requirements:

- Allow numeric values only.
- Do not allow alphabetic characters.
- Keep the existing CBC layout and styling.
- Do not remove or change Hb, TLC, or PLT.
- MCV should be saved with the patient's medical information.
- MCV should also be available to the analytics system for later analysis.

Do not make MCV a Yes/No field.

==================================================
PART 2 — MISSED SLOT → "OTHER" REASON
==================================================

Administrator Portal
→ Missed Slot

There is currently a reason selector containing an option:

"Other"

Currently, when the administrator selects "Other", it only displays the word "Other".

Change this behavior.

When the administrator selects:

Other

display an additional text input/text area immediately below the reason selector.

Label:

"Please specify"

Example:

Reason:
[ Other ▼ ]

Please specify:
[ Patient was admitted to another hospital __________ ]

The administrator must be able to type the actual reason.

Requirements:

- The "Please specify" field should appear ONLY when "Other" is selected.
- If another predefined reason is selected, hide the "Please specify" field.
- When "Other" is selected, the administrator should be able to enter free text.
- Save the entered explanation along with the missed-slot record.
- Display the explanation when viewing the missed-slot record/history.
- Do not remove any existing predefined missed-slot reasons.

==================================================
PART 3 — MISSED SLOT ANALYTICS
==================================================

Add a new analytics category:

"Missed Slots"

to BOTH:

1. Administrator Portal → Analytics
2. Doctor Portal → Analytics

Place it alongside the existing analytics categories.

Use actual missed-slot records from the database.

--------------------------------------------------
MISSED SLOT OVERVIEW
--------------------------------------------------

Show:

- Total missed slots
- Missed slots today
- Missed slots this week
- Missed slots this month
- Missed slot percentage

Use the selected Analytics date range where applicable.

--------------------------------------------------
MISSED SLOT REASONS
--------------------------------------------------

Show a chart/table containing the number of missed slots by reason.

Use the existing predefined reasons.

Also include:

Other

If "Other" is selected, count it under "Other" while retaining the actual explanation in the underlying record.

Example:

Reason              Count
--------------------------------
Went to another     12
dialysis center
Expired              4
Other                6
Other reasons       ...

--------------------------------------------------
CUSTOM "OTHER" REASON ANALYTICS
--------------------------------------------------

For records where the reason is "Other", display the actual entered explanations in a table.

Example:

Other Missed Slot Reasons

Date        Patient        Explanation
------------------------------------------------
21 Aug      Patient A      Admitted elsewhere
20 Aug      Patient B      Travelled to hometown
18 Aug      Patient C      Hospitalized

Do not expose unnecessary patient information in charts.

--------------------------------------------------
MISSED SLOT TREND
--------------------------------------------------

Add a line/bar chart showing missed slots over time.

Allow:

- Daily
- Weekly
- Monthly

view.

==================================================
PART 4 — BASIC INVESTIGATION ANALYTICS
==================================================

Improve the existing:

Analytics
→ Clinical Investigation / Basic Investigation

in BOTH Administrator and Doctor portals.

The analytics should have a clear analytical structure rather than simply displaying a list of investigation names.

Use actual stored data.

Create a summary section showing:

- Total patients
- Patients with investigation data
- Patients without investigation data
- Investigation completion percentage

Then provide a dropdown:

"Select Investigation"

Options:

- All Basic Investigations
- CBC
- Serum Ferritin
- Serum Calcium
- Thyroid Profile
- 2D Echo
- EF
- Serum Phosphorous
- Renal Function Test

When:

"All Basic Investigations"

is selected, show an overview/comparison of all investigations.

When a specific investigation is selected, show ONLY analytics for that investigation.

--------------------------------------------------
CBC ANALYTICS
--------------------------------------------------

When CBC is selected, show:

- Hb
- TLC
- PLT
- MCV

For MCV, because it is numeric:

Show where actual values are available:

- Number of patients with MCV recorded
- Average MCV
- Minimum MCV
- Maximum MCV
- MCV distribution

Do NOT generate values for patients where MCV was not entered.

For Hb, TLC, and PLT, use the actual data structure currently stored.

If those fields are currently only stored as completion/availability information, show completion analytics rather than inventing numerical laboratory values.

==================================================
PART 5 — NEW ANALYTICS DROPDOWN:
ALL COMORBIDITIES / ALL LFT / ACCESS
==================================================

Add a NEW analytics card/section in BOTH:

Administrator Portal → Analytics
Doctor Portal → Analytics

Title:

"Additional Clinical Analytics"

At the top of this section create ONE dropdown:

"Select Clinical Category"

Dropdown options MUST be exactly:

1. All Comorbidities
2. All LFT
3. Access

Default:

"All Comorbidities"

IMPORTANT:
Only ONE of these three categories should be displayed at a time.

When the user selects a category, replace the content below the dropdown with the analytics for that selected category.

Do NOT display all three sections simultaneously.

==================================================
OPTION 1 — ALL COMORBIDITIES
==================================================

When:

"All Comorbidities"

is selected, show analytics based on the patient's recorded comorbidities.

Current comorbidity options include:

- Hypertension
- Diabetes

If the application already contains additional comorbidity values, include them as well.

Show:

- Total patients
- Patients with no recorded comorbidity
- Patients with one or more comorbidities
- Percentage distribution

Use a bar chart or donut chart.

Also show a table:

Comorbidity | Patient Count | Percentage

For the current fields, distinguish:

- Hypertension only
- Diabetes only
- Both Hypertension and Diabetes
- Neither

Use actual patient records.

==================================================
OPTION 2 — ALL LFT
==================================================

When:

"All LFT"

is selected, show LFT-related analytics.

IMPORTANT:
First inspect the existing patient/medical-information data structure and use the actual LFT fields already present in the application.

If LFT fields currently include parameters such as:

- Bilirubin
- SGOT/AST
- SGPT/ALT
- ALP
- Albumin
- Total Protein
- Other existing LFT parameters

display those actual parameters.

Do not create fake LFT parameters if they do not exist in the database.

Show:

- Number of patients with LFT recorded
- Number pending/not recorded
- Completion percentage
- Parameter-wise availability/completion

If actual numerical LFT values are stored, additionally show:

- Average
- Minimum
- Maximum
- Distribution

If numerical values are NOT currently stored, show only completion/recorded analytics.

==================================================
OPTION 3 — ACCESS
==================================================

When:

"Access"

is selected, show dialysis access analytics.

Current Access options:

- AVF
- Permacath
- Temp Catheter

Show:

- Total patients with access information
- AVF count and percentage
- Permacath count and percentage
- Temp Catheter count and percentage
- Patients with no access recorded

Use:

Access Type | Patient Count | Percentage

and a clear chart.

==================================================
PART 6 — DOCTOR PORTAL
==================================================

Add all of the above analytics to the Doctor Portal as well.

Doctor Portal Analytics should contain:

- Clinical Investigation
- Viral Status
- Prescription
- Dialysis
- Patient Outcomes
- Machine Utilization
- Missed Slots
- Additional Clinical Analytics

The Additional Clinical Analytics dropdown must contain:

- All Comorbidities
- All LFT
- Access

Doctors should be able to view the analytics but analytics must remain READ-ONLY.

Do not allow doctors to edit patient records from Analytics.

Respect the existing doctor authorization rules and show only data the logged-in doctor is permitted to access.

==================================================
PART 7 — ADMINISTRATOR PORTAL
==================================================

Administrator Portal Analytics should contain:

- Clinical Investigation
- Viral Status
- Prescription
- Dialysis
- Patient Outcomes
- Machine Utilization
- Missed Slots
- Additional Clinical Analytics

Administrators can view all analytics permitted by their existing role.

Analytics should remain READ-ONLY.

Existing administrative functions should continue to be performed through their existing pages.

==================================================
PART 8 — COMMON FILTERS
==================================================

Keep the existing Analytics date-range filter:

- Today
- This Week
- This Month
- Last 3 Months
- This Year
- Custom Range

For Administrator Portal, retain:

- All Units
- Unit 1
- Unit 2

The selected filters should update:

- Clinical Investigation analytics
- Viral Status analytics
- Prescription analytics
- Dialysis analytics
- Patient Outcomes analytics
- Machine Utilization analytics
- Missed Slot analytics
- Comorbidity analytics
- LFT analytics
- Access analytics

==================================================
PART 9 — DATA ACCURACY
==================================================

Do NOT use hardcoded analytics numbers.

All analytics must be calculated from the actual database.

If no data exists:

Display:

"No data available"

or:

"0"

Do not generate fake charts or statistics.

Do not modify historical patient records merely to support analytics.

==================================================
PART 10 — IMPORTANT UI BEHAVIOR
==================================================

The dropdowns must work as true selection controls.

For Clinical Investigation:

[ Select Investigation ▼ ]

For Additional Clinical Analytics:

[ Select Clinical Category ▼ ]

When a specific option is selected:

- Update the analytics content immediately.
- Do not navigate to another page.
- Do not reload the entire application.
- Keep the dropdown visible so the user can switch between categories easily.

Example:

Additional Clinical Analytics

[ Access ▼ ]

Access Analytics
----------------
AVF          120 patients   55%
Permacath     70 patients   32%
Temp Catheter 28 patients   13%

If the user changes:

[ All Comorbidities ▼ ]

the Access analytics should disappear and the Comorbidity analytics should appear in the same analytics area.

==================================================
FINAL TESTING
==================================================

Verify all of the following:

1. MCV appears under Register Patient → CBC.
2. MCV accepts numeric input.
3. MCV is saved correctly.
4. Selecting "Other" in Missed Slot displays a text input.
5. The custom Other explanation is saved.
6. The custom explanation appears in missed-slot history.
7. Missed Slot Analytics appears in Administrator Portal.
8. Missed Slot Analytics appears in Doctor Portal.
9. Missed-slot counts use real database records.
10. Basic Investigation Analytics includes CBC, including MCV.
11. Additional Clinical Analytics exists in both portals.
12. Its dropdown contains exactly:
    - All Comorbidities
    - All LFT
    - Access
13. Selecting All Comorbidities displays only Comorbidity analytics.
14. Selecting All LFT displays only LFT analytics.
15. Selecting Access displays only Access analytics.
16. All analytics use real stored data.
17. No fake/hardcoded numbers are used.
18. Analytics remain read-only.
19. Existing Administrator and Doctor Portal functionality remains unchanged.
20. Patient Portal remains completely unchanged.