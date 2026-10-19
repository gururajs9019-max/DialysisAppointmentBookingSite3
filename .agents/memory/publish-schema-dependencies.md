---
name: Publish foreign-key dependencies
description: Verify referenced unique constraints and generated statement ordering before declaring migrations ready.
---

For new composite foreign keys, inspect the actual development-to-production Publish diff: the referenced unique key must be present in the diff and created before its dependent foreign key.

**Why:** In this project, a valid standalone unique index in development was omitted from the generated Publish migration. Attaching it to an explicit UNIQUE constraint made the key appear, but the regenerated diff still placed the foreign key before that key. Development schema tests alone did not detect that ordering problem; an isolated replay did.

**How to apply:** Use production read-only catalog queries and recompute the Publish diff after dev-side fixes. Check dependencies in statement order, not just statement presence. If staged publishing is necessary, obtain approval before temporarily removing a development integrity constraint, retain API validation, publish the referenced key first, and restore the dependent relationship for a subsequent publish. Never apply DDL directly to production or add startup/deploy-time migration hooks.
