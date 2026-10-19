---
name: Staff prescription notification audience
description: Distinguish clinical responsibility from broad staff read permissions when choosing notification recipients.
---

Do not treat broad Doctor Portal read access as responsibility for every patient. Prescription alerts belong to active administrators and active doctors with explicit clinical relationships, excluding the actor. A patient without explicit doctor links must not cause an all-doctor broadcast.

**Why:** The requested feature is for responsible clinicians, not every account allowed to browse staff records. Legacy free-text doctor names cannot establish a reliable or authorized clinical identity.

**How to apply:** Preserve this narrower notification audience independently of existing record-access permissions. Do not infer responsibility from names or expand patient-facing permissions to make notification links work.
