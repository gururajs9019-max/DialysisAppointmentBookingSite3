import { appointmentInterval, appointmentsOverlap, MACHINE_RESERVED_MESSAGE } from "../shared/scheduling.mjs";
import { httpError } from "./api-errors.mjs";

export function validateSessionTime(input) {
  if (!["Slot 1", "Slot 2", "Slot 3", "Emergency"].includes(input.slot) ||
      (input.slotType && !["normal", "emergency"].includes(input.slotType)) ||
      (input.slotType === "emergency" && input.slot !== "Emergency") ||
      (input.slotType === "normal" && input.slot === "Emergency") ||
      !appointmentInterval(input)) {
    throw httpError(400, "Choose a supported time slot, or a valid emergency time and duration.");
  }
}

// Call only while holding both the patient row and destination machine row
// locks. These locks serialize all writers, including different slot labels
// whose actual treatment times overlap. Existing unique indexes add a second
// guard for identical normal-slot reservations.
export async function assertSessionAvailable(client, candidate, excludeId = null) {
  if (["cancelled", "missed"].includes(candidate.status)) return;
  validateSessionTime(candidate);
  const existing = await client.query(`
    SELECT id,patient_id,machine_id,session_date::text AS date,slot,status,data
    FROM dialysis_sessions
    WHERE session_date BETWEEN $1::date - 1 AND $1::date + 1
      AND (machine_id=$2 OR patient_id=$3)
      AND ($4::text IS NULL OR id<>$4)
      AND status NOT IN ('cancelled','missed')
  `, [candidate.date, candidate.machineId, candidate.patientId, excludeId]);
  const conflicts = existing.rows.filter(row => appointmentsOverlap(candidate, {
    ...row.data, date: row.date, slot: row.slot, status: row.status,
  }));
  if (conflicts.some(row => row.machine_id === candidate.machineId)) {
    throw httpError(409, MACHINE_RESERVED_MESSAGE);
  }
  if (conflicts.some(row => row.patient_id === candidate.patientId)) {
    throw httpError(409, "This patient is already booked for an overlapping dialysis session. Please select another time slot.");
  }
}
