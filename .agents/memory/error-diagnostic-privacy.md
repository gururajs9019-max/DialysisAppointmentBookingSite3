---
name: Error diagnostic privacy
description: Privacy tradeoff when debugging unexpected request failures in the dialysis application.
---

Unexpected API/request diagnostics must prioritize clinical and account privacy over verbose exception dumps, including during publishing investigations.

**Why:** The user requested protection against sensitive details appearing in unexpected API error logs. Database and library exceptions can embed submitted record values or credentials even when the application does not intentionally log forms.

**How to apply:** Use bounded, allowlisted diagnostic categories rather than raw exceptions or request context. Do not temporarily restore full error logging to diagnose an unclear production failure. Keep intentional validation and clinical version-conflict responses usable, and use synthetic data for privacy regression tests.
