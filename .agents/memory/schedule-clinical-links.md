---
name: Historical clinical assignments
description: Preserve unassigned historical schedules without guessing clinical identities or prescriptions.
---

Keep unassigned schedules valid. Do not automatically infer a historical doctor's identity from a display name or attach a patient's current prescription to an earlier session.

**Why:** Earlier schedules may contain only free-text names, and the current prescription may differ from the treatment intended at that time. Guessing would invent clinical relationships.

**How to apply:** Validate explicit new assignments against the active doctor directory and the selected patient's current prescriptions. Retain existing historical display data and links rather than replacing them during refresh, migration, or account changes.
