/**
 * Applies the optimistic-looking machine update only after the durable
 * scheduling callback resolves. Keeping this dependency-free makes the
 * failure behavior executable in a Node regression test.
 */
export async function persistQuickAssignment(assignSession, updateMachine, session, machineId) {
  await assignSession(session, machineId);
  updateMachine(machineId, session.patientName);
}