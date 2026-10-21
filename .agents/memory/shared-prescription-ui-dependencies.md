---
name: Shared prescription UI dependencies
description: Rationale for keeping reusable Administrator/Doctor prescription values outside the Admin page module.
---

Shared prescription UI reused by Administrator and Doctor pages should import pure option and formatting helpers from a shared library module, never runtime values from the Admin page module.

**Why:** AdminApp itself renders the shared DoctorPrescription component; importing values back from AdminApp creates a runtime cycle and makes hot reload fragile.

**How to apply:** Keep reusable prescription labels, options, and timestamp formatting in a dependency-light shared module. Use type-only imports from the Admin page module only where shared model types remain declared there.
