---
name: Staff history loading
description: Rationale for caching prescription histories instead of changing staff history screens.
---

Prefer version-aware history reuse for periodic refreshes without changing the existing history and comparison screens. Cold staff loads still retrieve histories; moving to on-demand loading needs explicit loading, retry, and error states in every staff history view.

**Why:** Staff history appears in several views, not just an opened history panel. The optimization was deliberately scoped to eliminating repeated downloads while preserving complete comparison data and visible load failures.

**How to apply:** If optimizing first-load performance later, handle all Administrator and Doctor history views together rather than silently substituting empty history arrays. Preserve the staff-only boundary.
