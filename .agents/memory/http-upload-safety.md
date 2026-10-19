---
name: HTTP upload safety
description: Why upload rejection needs real-connection tests and byte-based limits.
---

Treat invalid or interrupted uploads as failures of one request, not of staff access. Check error delivery over real HTTP connections rather than relying only on mocked streams.

**Why:** Node's default readable async iterator destroys its input on early termination. For an HTTP request, rejecting inside that iteration can close the socket before the client receives its error response. JavaScript string length also undercounts multibyte UTF-8 payloads.

**How to apply:** Keep upload budgets byte-based, preserve split UTF-8 characters, and verify oversized declarations, chunked overflow and interrupted uploads with real sockets. Confirm that the same process keeps serving both staff roles and that incomplete clinical submissions cannot change records or versions. Avoid closing the connection before an oversized-request response has been sent.
