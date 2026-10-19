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
const input={ uhid:"TEST-WEIGHT",name:"Example",medicalInfo:{dryWeight:"52.5",weightGain:0,hypertension:"140"} };
assert.deepEqual(validatePatient(input).medicalInfo,{dryWeight:52.5,weightGain:0,hypertension:"140"});
assert.equal(input.medicalInfo.dryWeight,"52.5","validation does not mutate the caller's medical information");
assert.deepEqual(validatePatient({medicalInfo:{dryWeight:"",weightGain:null}},true).medicalInfo,{dryWeight:"",weightGain:null});
for(const [key,values] of [
  ["dryWeight",[-1,0,"invalid",true,[],{},Infinity]],
  ["weightGain",[-1,"invalid",true,[],{},Infinity]],
]) for(const value of values) {
  assert.throws(()=>validatePatient({medicalInfo:{[key]:value}},true),/must be a number/);
}
assert.deepEqual(validatePatient({medicalInfo:{dryWeight:52.5,weightGain:2.5}},true).medicalInfo,{dryWeight:52.5,weightGain:2.5});
console.log("backend validation tests passed");