---
name: Database calendar dates
description: Preserve day-only scheduling values at the API boundary.
---

Treat dialysis scheduling dates as calendar days, not timestamps.

**Why:** The PostgreSQL driver in this environment materializes date-only columns as local Date objects. Default JSON serialization changes their format to timestamps, breaking day equality in existing session lookups.

**How to apply:** Normalize authoritative database dates to YYYY-MM-DD using their calendar components. Do not depend on the original JSON payload to preserve the date format or introduce UTC conversion for date-only values.
