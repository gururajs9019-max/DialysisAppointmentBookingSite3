// No database or secrets are needed: this covers exported domain rules only.
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "test-session-secret-not-for-production";
const { compatibleMachine, requiredViralCategory, validatePatient } = await import("./index.mjs");

assert.equal(requiredViralCategory({ hepatitisB: "Positive" }), "HBsAg");
assert.equal(requiredViralCategory({ hepatitisC: "Positive" }), "HCV");
assert.equal(requiredViralCategory({ hiv: "Positive" }), "HIV");
assert.equal(compatibleMachine("HIV", "RVD (HIV)"), true);
assert.equal(compatibleMachine("HCV", "Negative"), false);
assert.equal(validatePatient({ uhid: "TEST-1", name: "Example", viralStatus: { hiv: "Positive" } }).viralCategory, "HIV");
assert.throws(() => validatePatient({ uhid: "", name: "Example" }), /Invalid UHID/);
console.log("backend validation tests passed");