---
name: Prescription record safety
description: Separate new prescriptions from amendments and distinguish retries from new clinical orders.
---

Doctors must be able to create another prescription for a registered patient even when that patient already has prescription history. Creating a prescription must not replace an earlier record.

**Why:** The user explicitly requires both first-time and repeat prescription creation while preserving historical medical records. Two prescriptions for one patient may be legitimate; repeated delivery of one save request is not a second clinical order.

**How to apply:** Keep new-record creation separate from the existing versioned revision workflow. Deduplicate retries by creation-request identity, never by patient identity. Reuse the existing prescription status and authorization model instead of inventing a new clinical approval workflow.
