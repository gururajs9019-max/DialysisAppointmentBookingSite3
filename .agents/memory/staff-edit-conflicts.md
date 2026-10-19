---
name: Staff edit conflicts
description: Why prescription drafts must keep their original base until staff review a newer revision.
---

Never advance an open prescription draft's base version just because a background refresh found a newer prescription. Staff must explicitly compare and choose values before rebasing.

**Why:** Administrator and Doctor edits contain clinical decisions. A refreshed list does not mean an older draft includes another staff member's changes; silently updating its base would defeat overwrite protection.

**How to apply:** Preserve this distinction when changing staff synchronization, history loading, or edit recovery. Failed comparisons must leave the draft and its original base available for retry. Unsaved-change warnings must compare against the editor's starting values, not redefine clean/dirty from a background refresh; warnings must not autosave clinical decisions.
