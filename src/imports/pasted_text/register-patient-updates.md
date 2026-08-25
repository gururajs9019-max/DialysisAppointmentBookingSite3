Figma Prompt – Update Medical Information and Patient Status

Update ONLY the existing Administrator Portal → Register Patient form.

Do not modify the Patient Portal, Doctor Portal, or any unrelated Administrator Portal functionality.

Do not rebuild the page from scratch. Inspect the existing Register Patient form and modify the existing components in place. Preserve the current design system, colors, typography, spacing, card style, responsive layout, and all previously implemented fields and functionality.

==================================================
1. ADD NEW "LFT" SECTION
==================================================

Inside:

Administrator Portal
→ Register Patient
→ Medical Information

create a new subsection called:

"LFT"

LFT must be placed inside the existing Medical Information card, just like the existing Basic Investigation and other medical subsections.

Do NOT create a separate card or separate page for LFT.

Under LFT, add the following fields:

1. Total Protein
2. Albumin
3. Total Bilirubin (TB)
4. Direct Bilirubin (DB)
5. AST
6. ALT
7. ALP

Each of these must be a NUMBER INPUT field.

Example:

LFT

Total Protein
[ __________ ]

Albumin
[ __________ ]

Total Bilirubin (TB)
[ __________ ]

Direct Bilirubin (DB)
[ __________ ]

AST
[ __________ ]

ALT
[ __________ ]

ALP
[ __________ ]

==================================================
2. NUMBER INPUT BEHAVIOR FOR LFT
==================================================

All LFT fields should:

- Accept numeric values.
- Allow decimal values where appropriate.
- Prevent alphabetic characters.
- Use the same number-input styling already used elsewhere in the Medical Information section.
- Be individually editable.
- Be individually clearable.
- Not be required unless the existing form validation specifically requires them.
- Not cause the page to jump or scroll unexpectedly when entering values.

Do not add Yes/No options or checkboxes for these LFT fields.

==================================================
3. MOVE RENAL FUNCTION TEST
==================================================

Inside:

Medical Information
→ Basic Investigation

there is currently a:

"Renal Function Test"

section.

Move the entire Renal Function Test section so that it appears immediately AFTER the CBC section.

The order should be:

Basic Investigation

1. CBC
   - Hb
   - TLC
   - PLT

2. Renal Function Test
   - Urea
   - Serum Creatinine

3. Serum Ferritin

4. Serum Calcium

5. Thyroid Profile
   - T3
   - T4
   - TSH

6. 2D Echo

7. EF

8. Serum Phosphorous

Maintain the existing number-input behavior of Renal Function Test:

Urea
[ __________ ]

Serum Creatinine
[ __________ ]

Do not change the fields or their functionality. Only change their position so Renal Function Test comes immediately after CBC.

==================================================
4. REMOVE "EXPIRED" FROM PATIENT STATUS
==================================================

Inside:

Administrator Portal
→ Register Patient
→ Personal Information
→ Patient Status

there are currently multiple patient status options.

Remove ONLY the option:

"Expired"

from the Patient Status selection.

Keep all other existing Patient Status options unchanged.

Do not replace "Expired" with another option.

The Patient Status section should continue to use the same existing selection control and styling.

==================================================
5. IMPORTANT – DO NOT CHANGE EXISTING FUNCTIONALITY
==================================================

Do not modify:

- Patient Portal
- Doctor Portal
- Machine Management
- Dialysis Scheduling
- Patient History
- Viral Status
- Access section
- Scheme section
- Comorbidities
- CBC
- Existing medical information fields
- Existing EF field
- Existing OPD/IPD field
- Existing patient registration workflow

Only make these three requested changes:

1. Add LFT inside the existing Medical Information card.
2. Move Renal Function Test immediately below CBC.
3. Remove "Expired" from Patient Status.

==================================================
6. FINAL MEDICAL INFORMATION STRUCTURE
==================================================

Keep the existing Medical Information fields and organize the relevant sections as follows:

Medical Information

- Native Kidney Disease
- Cause of Failure
- Treating Nephrologist
- Scheme
- Comorbidities
- Remarks
- Viral Panel
- Access

Basic Investigation

- CBC
  - Hb
  - TLC
  - PLT

- Renal Function Test
  - Urea
  - Serum Creatinine

- Serum Ferritin
- Serum Calcium

- Thyroid Profile
  - T3
  - T4
  - TSH

- 2D Echo
- EF
- Serum Phosphorous

LFT

- Total Protein
- Albumin
- Total Bilirubin (TB)
- Direct Bilirubin (DB)
- AST
- ALT
- ALP

OPD/IPD

Keep LFT and Basic Investigation visually organized as subsections INSIDE the same Medical Information card.

==================================================
FINAL INSTRUCTION
==================================================

First inspect the existing Register Patient → Medical Information design.

Modify the existing components instead of creating duplicates.

Do not redesign the page.

Do not remove any existing fields except the "Expired" Patient Status option.

Do not affect the Patient Portal or Doctor Portal.

Preserve all previously completed work.