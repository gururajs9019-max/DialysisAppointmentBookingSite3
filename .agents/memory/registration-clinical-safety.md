---
name: Registration clinical safety
description: Preserve historical clinical readings when simplifying registration controls, and keep entered registration weights independent.
---

Changing comorbidities to checkbox-only controls does not authorize deleting older clinical readings or named conditions.

**Why:** The user requested simpler Administrator registration while explicitly preserving existing patient medical information and investigation history.

**How to apply:** Keep checkbox selections separate from legacy readings. Changes to the available controls must not trigger broad data cleanup or rewrite older records.

Registration Dry Weight and Weight Gain are independently entered clinical values, not automatic calculations or replacements for prescription instructions.

**Why:** The user explicitly prohibited automatic calculation or overwriting without an existing reliable rule.

**How to apply:** Preserve both entered values across saving and editing; do not infer them from each other or from a prescription.
