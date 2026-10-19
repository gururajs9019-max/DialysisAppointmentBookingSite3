---
name: Staff edit conflicts
description: Why prescription and clinical-note drafts keep their original base until explicit review.
---

Never advance an open prescription or clinical-note draft's base version just because a background refresh found a newer record. Staff must explicitly compare and choose values before rebasing.

**Why:** Administrator and Doctor edits contain clinical decisions. A refreshed list does not mean an older draft includes another staff member's changes; silently updating its base would defeat overwrite protection.

**How to apply:** Preserve this distinction when changing staff synchronization, history loading, or edit recovery. Failed comparisons must leave the draft and its original base available for retry. Unsaved-change warnings must compare against the editor's starting values, not redefine clean/dirty from a background refresh; warnings must not autosave clinical decisions.

After explicit clinical-note conflict review, the clean baseline is the newer saved note, not the merged values applied to the editor. Pending field choices also count as unsaved changes.

**Why:** Applying reviewed values is not a save. Treating the reviewed draft as clean could discard clinical decisions without warning, while choosing only saved values should not cause unnecessary warnings.

**How to apply:** Preserve choices when staff cancel leaving, and keep warnings active for retained draft values until saved, reverted to the reviewed saved values, or explicitly discarded. Never persist clinical drafts in browser storage.

Use integer database revisions for clinical-note concurrency instead of timestamp equality.

**Why:** Timestamp serialization can lose database precision, and timestamps are display metadata rather than a reliable editor baseline. Notes can be edited by both their author and an administrator, so either writer must detect stale changes.

**How to apply:** Require the captured revision on every edit, check it under the row lock, and advance it only on a successful save. Rejected conflicts must not emit successful-update audits or notifications.

Staff form initialization must follow deliberate navigation identity, not refreshed directory-object identity.

**Why:** Background refreshes replace otherwise equivalent objects. Reinitializing from those references can restart an assignment wizard, including immediately after a successful save; faster production responses exposed this intermittent behavior.

**How to apply:** Keep initialization keyed to stable patient, machine, and unit identities. Test a real staff refresh while a form is in progress and verify that its step and entered values survive.
