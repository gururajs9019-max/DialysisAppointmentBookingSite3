export const MACHINE_RESERVED_MESSAGE = "This machine is already reserved for the selected time slot. Please select another available machine or time slot.";
const NORMAL = { "Slot 1": [480, 720], "Slot 2": [720, 960], "Slot 3": [960, 1200] };
function minutes(value) {
  const match = String(value ?? "").trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hour = Number(match[1]), minute = Number(match[2]);
  if (minute > 59 || (match[3] ? hour < 1 || hour > 12 : hour > 23)) return null;
  if (match[3]) hour = hour % 12 + (/PM/i.test(match[3]) ? 12 : 0);
  return hour * 60 + minute;
}
export function prescriptionSlot(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return { slot: "", issue: "missing" };
  if (NORMAL[raw]) return { slot: raw, issue: null };
  const parts = raw.split(/\s*[–—-]\s*/);
  if (parts.length === 2) {
    const start = minutes(parts[0]), end = minutes(parts[1]);
    const found = Object.entries(NORMAL).find(([, range]) => range[0] === start && range[1] === end);
    if (found) return { slot: found[0], issue: null };
  }
  return { slot: "", issue: "unsupported" };
}
export function appointmentInterval(session) {
  const date = String(session.date ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const day = Date.parse(`${date}T00:00:00Z`) / 60000;
  if (!Number.isFinite(day) || new Date(day * 60000).toISOString().slice(0, 10) !== date) return null;
  const normal = NORMAL[session.slot];
  if (normal && session.slotType !== "emergency") return { start: day + normal[0], end: day + normal[1] };
  if (session.slot !== "Emergency" && session.slotType !== "emergency") return null;
  const start = minutes(session.emergencyTime || session.startTime);
  const duration = String(session.duration || "4 hours").match(/^(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)$/i);
  if (start === null || !duration || Number(duration[1]) <= 0 || Number(duration[1]) > 24) return null;
  return { start: day + start, end: day + start + Number(duration[1]) * 60 };
}
export function appointmentsOverlap(a, b) {
  // Preserve the existing database's one-reservation-per-slot rule, including
  // its single Emergency reservation per machine/patient/calendar day.
  if (a.date === b.date && a.slot === b.slot) return true;
  const left = appointmentInterval(a), right = appointmentInterval(b);
  // Unreadable legacy bookings conservatively reserve their calendar day.
  if (!left || !right) return a.date === b.date;
  return left.start < right.end && right.start < left.end;
}
export function blocksReservation(session) {
  return !["cancelled", "missed"].includes(String(session.status).toLowerCase());
}
