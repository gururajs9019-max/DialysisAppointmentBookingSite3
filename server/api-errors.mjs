// Only application-created HTTP errors may expose an intentional client message.
// Database/library errors can contain row values, credentials, SQL and stacks.
const publicErrors = new WeakSet();
const conflictCodes = new Set(["PRESCRIPTION_VERSION_CONFLICT", "CLINICAL_NOTE_VERSION_CONFLICT"]);
const diagnosticCodes = new Set([
  "08000", "08001", "08003", "08006", "22001", "22P02",
  "23502", "23503", "23505", "23514", "40001", "40P01",
  "42P01", "42703", "53300", "57P01", "57P02", "57P03",
  "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EPIPE", "ENOTFOUND",
]);

export function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  publicErrors.add(error);
  return error;
}

export function apiErrorResponse(error) {
  const isPublic = publicErrors.has(error);
  const status = isPublic && Number.isInteger(error.statusCode) && error.statusCode >= 400 && error.statusCode <= 599
    ? error.statusCode
    : error?.code === "42P01" ? 503 : 500;
  if (status >= 500) {
    // Never pass the original error or any request data to the logger.
    // Codes are exact allowlist matches, not arbitrary strings from an error.
    console.error("Unexpected API failure.", {
      status,
      code: diagnosticCodes.has(error?.code) ? error.code : "UNEXPECTED",
    });
    return { status, body: { error: "Unexpected server error." } };
  }

  const body = { error: typeof error.message === "string" && error.message ? error.message : "Request failed." };
  if (status === 409 && conflictCodes.has(error.code) && Number.isSafeInteger(error.currentVersion) && error.currentVersion > 0) {
    body.code = error.code;
    body.currentVersion = error.currentVersion;
  }
  return { status, body };
}
