import assert from "node:assert/strict";
import { persistQuickAssignment } from "../src/app/lib/quickAssignment.mjs";

const session = { id: "session-1", patientName: "Test Patient" };
let machineUpdate;

await assert.rejects(
  () => persistQuickAssignment(
    async () => { throw new Error("Scheduling conflict"); },
    (...args) => { machineUpdate = args; },
    session,
    "machine-1",
  ),
  /Scheduling conflict/,
);
assert.equal(machineUpdate, undefined, "a failed assignment must not change local machine state");

await persistQuickAssignment(
  async () => undefined,
  (...args) => { machineUpdate = args; },
  session,
  "machine-1",
);
assert.deepEqual(machineUpdate, ["machine-1", "Test Patient"], "machine state changes only after assignment succeeds");

console.log("quick assignment persistence tests passed");