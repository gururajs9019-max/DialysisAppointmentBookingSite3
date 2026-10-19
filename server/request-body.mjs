import { httpError } from "./api-errors.mjs";

export const MAX_JSON_BODY_BYTES = 1_000_000;

export async function readJson(req) {
  if (req.aborted) throw httpError(400, "Request was interrupted.");
  if (Number(req.headers?.["content-length"]) > MAX_JSON_BODY_BYTES) {
    throw httpError(413, "Request body is too large.");
  }
  const chunks = [];
  let bytes = 0;
  try {
    // The default async iterator destroys the incoming request on early return,
    // which can reset the socket before the client receives its 413 response.
    for await (const chunk of req.iterator({ destroyOnReturn: false })) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > MAX_JSON_BODY_BYTES) throw httpError(413, "Request body is too large.");
      chunks.push(buffer);
    }
  } catch (error) {
    if (req.aborted || ["ECONNRESET", "ERR_STREAM_PREMATURE_CLOSE"].includes(error?.code)) {
      throw httpError(400, "Request was interrupted.");
    }
    throw error;
  }
  if (req.aborted || req.complete === false) throw httpError(400, "Request was interrupted.");
  if (!bytes) return {};
  // Decode once, so a multi-byte character split between network chunks is not
  // corrupted. No partial JSON is parsed or passed to a write operation.
  const body = Buffer.concat(chunks, bytes).toString("utf8");
  try { return JSON.parse(body); } catch { throw httpError(400, "Request body must be valid JSON."); }
}
