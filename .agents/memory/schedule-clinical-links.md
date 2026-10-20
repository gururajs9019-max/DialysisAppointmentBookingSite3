---
name: Historical clinical assignments
description: Preserve unassigned historical schedules without guessing clinical identities or prescriptions.
---

Keep unassigned schedules valid. Do not automatically infer a historical doctor's identity from a display name or attach a patient's current prescription to an earlier session.

**Why:** Earlier schedules may contain only free-text names, and the current prescription may differ from the treatment intended at that time. Guessing would invent clinical relationships.

**How to apply:** Validate explicit new assignments against the active doctor directory and the selected patient's current prescriptions. Retain existing historical display data and links rather than replacing them during refresh, migration, or account changes.

## Scheduling preferences are not clinical assignments

For a new appointment, the latest current prescription may supply a suggested time slot, but reading that default must not automatically attach the prescription to the appointment. An administrator's manual appointment-slot override must survive selecting a clinical prescription and must never rewrite the prescription itself.

**Why:** A suggested scheduling preference is not evidence that a specific prescription was selected for treatment. Staff may choose the appointment time before selecting its clinical links; discarding that choice can silently change the intended booking.

**How to apply:** Show the source of the suggested slot separately from the editable appointment slot. Missing or unsupported defaults require an explicit manual slot, and rescheduling starts from the existing appointment rather than the patient's current prescription.
