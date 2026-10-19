---
name: Staff history loading
description: Preserve complete staff histories while optimizing cold loads and refreshes.
---

Preserve complete immutable history on staff loads and reuse unchanged versions during refreshes. Prefer bounded batch retrieval over one request per prescription; do not replace unloaded history with empty arrays. Moving to on-demand history needs explicit loading, retry, and error states in every staff history view.

**Why:** Several Administrator and Doctor views use history directly, including cross-patient history and version comparisons. Optimizing request counts must not make missing clinical records appear to be an empty history or remove earlier comparison snapshots.

**How to apply:** Cover cold loads, version invalidation, overlapping requests, visible failures/retries, and immutable snapshot isolation together. Keep caches scoped to the authenticated staff session and preserve the Patient Portal boundary.
