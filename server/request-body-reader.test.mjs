import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { MAX_JSON_BODY_BYTES, readJson } from "./request-body.mjs";

function input(chunks, headers = {}) {
  return Object.assign(Readable.from(chunks), { headers, complete: true });
}
const value = { body: "Clinical text 🩺 नमस्ते café", marker: "synthetic-only" };
const encoded = Buffer.from(JSON.stringify(value));
assert.deepEqual(
  await readJson(input(Array.from(encoded, byte => Buffer.from([byte])))),
  value,
  "characters split across input chunks must decode without corruption",
);
assert.deepEqual(await readJson(input([])), {});
await assert.rejects(readJson(input([Buffer.from("{")])), { statusCode: 400, message: "Request body must be valid JSON." });
const exact = Buffer.from(`{"padding":"${"x".repeat(MAX_JSON_BODY_BYTES - 14)}"}`);
assert.equal(exact.length, MAX_JSON_BODY_BYTES);
assert.equal((await readJson(input([exact]))).padding.length, MAX_JSON_BODY_BYTES - 14);
const over = input([exact, Buffer.from(" ")]);
await assert.rejects(readJson(over), { statusCode: 413, message: "Request body is too large." });
assert.equal(over.destroyed, false, "body overflow must leave the socket available to send 413");
over.destroy();
let readAttempted = false;
await assert.rejects(readJson({
  headers: { "content-length": String(MAX_JSON_BODY_BYTES + 1) },
  iterator() { readAttempted = true; throw new Error("must not read an oversized declaration"); },
}), { statusCode: 413 });
assert.equal(readAttempted, false);
const wide = Buffer.from(JSON.stringify({ padding: "🩺".repeat(260_000) }));
assert.ok(wide.toString().length < MAX_JSON_BODY_BYTES && wide.length > MAX_JSON_BODY_BYTES);
await assert.rejects(readJson(input([wide])), { statusCode: 413 });
await assert.rejects(readJson(Object.assign(input([Buffer.from("{}")]), { aborted: true })), { statusCode: 400, message: "Request was interrupted." });
await assert.rejects(readJson(Object.assign(input([Buffer.from("{}")]), { complete: false })), { statusCode: 400, message: "Request was interrupted." });
for (const code of ["ECONNRESET", "ERR_STREAM_PREMATURE_CLOSE"]) {
  const interrupted = input([]);
  interrupted.iterator = async function* () {
    yield Buffer.from('{"synthetic":"private-request-body-marker');
    throw Object.assign(new Error("private-request-body-marker"), { code });
  };
  await assert.rejects(readJson(interrupted), { statusCode: 400, message: "Request was interrupted." });
}
console.log("JSON body reader tests passed (byte boundaries, split UTF-8, bounded reads, and incomplete streams)");
