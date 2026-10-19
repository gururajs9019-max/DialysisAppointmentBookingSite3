---
name: Staff edit conflicts
description: Why prescription and clinical-note drafts keep their original base until explicit review.
---

Never advance an open prescription or clinical-note draft's base version just because a background refresh found a newer record. Staff must explicitly compare and choose values before rebasing.

**Why:** Administrator and Doctor edits contain clinical decisions. A refreshed list does not mean an older draft includes another staff member's changes; silently updating its base would defeat overwrite protection.

**How to apply:** Preserve this distinction when changing staff synchronization, history loading, or edit recovery. Failed comparisons must leave the draft and its original base available for retry. Unsaved-change warnings must compare against the editor's starting values, not redefine clean/dirty from a background refresh; warnings must not autosave clinical decisions.

Use integer database revisions for clinical-note concurrency instead of timestamp equality.

**Why:** Timestamp serialization can lose database precision, and timestamps are display metadata rather than a reliable editor baseline. Notes can be edited by both their author and an administrator, so either writer must detect stale changes.

**How to apply:** Require the captured revision on every edit, check it under the row lock, and advance it only on a successful save. Rejected conflicts must not emit successful-update audits or notifications.
