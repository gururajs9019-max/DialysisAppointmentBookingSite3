import type { AdminPrescription, DialysisSession, Machine, Patient, RxDialysis, RxMedication } from "../AdminApp";

export interface StaffAnalytics {
  patients: number;
  active_patients: number;
  available_machines: number;
  today_sessions: number;
  missed_last_30_days: number;
}

export interface StaffNotification {
  id: string;
  type?: "warning" | "info" | "error" | "success";
  message?: string;
  detail?: string;
  read: boolean;
  created_at?: string;
}

export interface StaffData {
  patients: Patient[];
  machines: Machine[];
  units: { id: string; name: string }[];
  sessions: DialysisSession[];
  prescriptions: AdminPrescription[];
  notifications: StaffNotification[];
  analytics: StaffAnalytics;
}

export class StaffApiError extends Error {
  constructor(message: string, public readonly operation: "load" | "save") {
    super(message);
    this.name = "StaffApiError";
  }
}

async function request<T>(url: string, options: RequestInit = {}, operation: "load" | "save" = "load"): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options.headers } });
  } catch {
    throw new StaffApiError("The staff service is unavailable. Check your connection and try again.", operation);
  }
  const body = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new StaffApiError(body?.error || `Staff request failed (${response.status}).`, operation);
  return body as T;
}

const asPatient = (p: Partial<Patient>): Patient => ({
  id: p.id || "", uhid: p.uhid || "", name: p.name || "Unnamed patient", age: p.age || 0,
  gender: p.gender || "Male", mobile: p.mobile || "", address: p.address || "", city: p.city || "",
  primaryDisease: p.primaryDisease || "", causeOfFailure: p.causeOfFailure || "", biopsyDone: Boolean(p.biopsyDone),
  biopsyDetails: p.biopsyDetails || "", comorbidities: p.comorbidities || "", bloodGroup: p.bloodGroup || "",
  dialysisStartDate: p.dialysisStartDate || "", referredBy: p.referredBy || "", treatingNephrologist: p.treatingNephrologist || "",
  viralStatus: p.viralStatus || { hepatitisB: "Unknown", hepatitisC: "Unknown", hiv: "Unknown", other: "" },
  emergencyContact: p.emergencyContact || "", insurance: p.insurance || "", remarks: p.remarks || "",
  treatmentStatus: p.treatmentStatus || "Active", registeredDate: p.registeredDate || "", lastDialysis: p.lastDialysis || "",
  currentSchedule: p.currentSchedule || null, dialysisDaysPerWeek: p.dialysisDaysPerWeek || 0, dialysisDays: p.dialysisDays || [],
});

const asMachine = (m: Record<string, unknown>): Machine => ({
  id: String(m.id), number: String(m.code || m.name || ""), unit: String(m.unit_id || ""), category: String(m.category || "Negative"),
  name: String(m.name || m.code || ""), status: (m.status || "available") as Machine["status"], currentPatient: null,
  nextPatient: null, nextAvailableTime: null, lastMaintenance: "", notes: String(m.notes || ""),
});

const asSession = (s: Record<string, unknown>): DialysisSession => {
  const rawStatus = String(s.status || "scheduled").toLowerCase();
  const statusMap: Record<string, DialysisSession["status"]> = {
    scheduled: "Scheduled", waiting: "Waiting", running: "Running", completed: "Completed",
    missed: "Missed", cancelled: "Cancelled",
  };
  const attendanceMap: Record<string, DialysisSession["attendance"]> = {
    scheduled: "Scheduled", waiting: "Scheduled", running: "Scheduled", completed: "Completed",
    missed: "Missed", cancelled: "Cancelled",
  };
  const rawAttendance = String(s.attendance || "");
  const attendance = (["Scheduled", "Completed", "Missed", "Cancelled"].includes(rawAttendance)
    ? rawAttendance
    : attendanceMap[rawStatus] || "Scheduled") as DialysisSession["attendance"];
  return { id: String(s.id), patientId: String(s.patientId || ""), patientName: String(s.patientName || ""),
    uhid: String(s.uhid || ""), date: String(s.date || ""), slot: String(s.slot || ""), machine: String(s.machine || ""),
    machineId: String(s.machineId || ""), unit: String(s.unit || ""), duration: String(s.duration || ""), doctor: String(s.doctor || ""),
    attendance,
    notes: String(s.notes || ""), startTime: String(s.startTime || ""), endTime: String(s.endTime || ""),
    status: statusMap[rawStatus] || "Scheduled", missedReason: typeof s.missedReason === "string" ? s.missedReason : undefined,
    missedReasonOther: typeof s.missedReasonOther === "string" ? s.missedReasonOther : undefined };
};

const asText = (value: unknown) => typeof value === "string" ? value : "";

function asDialysisRx(value: unknown): RxDialysis {
  const rx = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    weeklySessionsCount: asText(rx.weeklySessionsCount),
    dialysisDays: Array.isArray(rx.dialysisDays) ? rx.dialysisDays.filter((day): day is string => typeof day === "string") : [],
    slot: asText(rx.slot),
    duration: asText(rx.duration),
    bloodFlow: asText(rx.bloodFlow),
    dialysateFlow: asText(rx.dialysateFlow),
    membrane: asText(rx.membrane),
    dryWeight: asText(rx.dryWeight),
    anticoagulation: asText(rx.anticoagulation),
  };
}

function asMedications(value: unknown): RxMedication[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((med): med is Record<string, unknown> => Boolean(med) && typeof med === "object" && !Array.isArray(med))
    .map(med => ({
      name: asText(med.name),
      dose: asText(med.dose),
      frequency: asText(med.frequency),
      route: asText(med.route),
    }));
}

const asPrescription = (p: Record<string, any>): AdminPrescription => ({
  id: p.id, patientId: p.patientId, patientName: p.patientName || "", patientUhid: p.patientUhid || "",
  diagnosis: p.diagnosis || "", status: p.status || "Active", issuedDate: p.createdAt || "", updatedBy: p.updatedBy || "Staff",
  updatedByRole: "Doctor", lastUpdatedAt: p.updatedAt, dialysisRx: asDialysisRx(p.dialysisRx),
  medications: asMedications(p.medications), notes: p.notes || "", history: [],
}) as AdminPrescription;

const asHistory = (row: Record<string, any>): AdminPrescription["history"][number] => {
  const snapshot = row.snapshot || {};
  return {
    version: row.version, updatedDate: row.created_at || "", updatedAt: row.created_at,
    updatedBy: "Staff", updatedByRole: "Doctor", changedFields: [],
    dialysisRx: asDialysisRx(snapshot.dialysisRx), medications: asMedications(snapshot.medications),
    notes: snapshot.notes || "", status: snapshot.status || "Active",
  } as AdminPrescription["history"][number];
};

export async function fetchPrescriptions(): Promise<AdminPrescription[]> {
  const result = await request<{ prescriptions: Record<string, any>[] }>("/api/prescriptions");
  const prescriptions = result.prescriptions.map(asPrescription);
  await Promise.all(prescriptions.map(async prescription => {
    const history = await request<{ history: Record<string, any>[] }>(`/api/prescriptions/${encodeURIComponent(prescription.id)}/history`);
    prescription.history = history.history.map(asHistory).sort((a, b) => b.version - a.version);
  }));
  return prescriptions;
}

export async function loadStaffData(): Promise<StaffData> {
  const [patients, machines, units, sessions, prescriptions, notifications, analytics] = await Promise.all([
    request<{ patients: Partial<Patient>[] }>("/api/patients"), request<{ machines: Record<string, unknown>[] }>("/api/machines"),
    request<{ units: { id: string; name: string }[] }>("/api/units"), request<{ sessions: Record<string, unknown>[] }>("/api/sessions"),
    fetchPrescriptions(), request<{ notifications: StaffNotification[] }>("/api/notifications"),
    request<{ analytics: StaffAnalytics }>("/api/analytics"),
  ]);
  return { patients: patients.patients.map(asPatient), machines: machines.machines.map(asMachine), units: units.units,
    sessions: sessions.sessions.map(asSession), prescriptions,
    notifications: notifications.notifications, analytics: analytics.analytics };
}

export async function updatePrescription(id: string, prescription: AdminPrescription): Promise<AdminPrescription> {
  await request(`/api/prescriptions/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({
    diagnosis: prescription.diagnosis, dialysisRx: prescription.dialysisRx, medications: prescription.medications,
    notes: prescription.notes, status: "Revised",
  }) }, "save");
  const refreshed = await fetchPrescriptions();
  const saved = refreshed.find(item => item.id === id);
  if (!saved) throw new StaffApiError("The saved prescription could not be reloaded.", "load");
  return saved;
}

export interface ClinicalNoteDto { id: string; patient_id: string; body: string; created_at: string; author_name?: string; }
export const fetchClinicalNotes = (patientId: string) => request<{ notes: ClinicalNoteDto[] }>(`/api/patients/${encodeURIComponent(patientId)}/clinical-notes`);
export const createClinicalNote = (patientId: string, body: string) => request<{ note: ClinicalNoteDto }>("/api/clinical-notes", { method: "POST", body: JSON.stringify({ patientId, body }) }, "save");

export const createPatient = (patient: Record<string, unknown>) =>
  request<{ patient: Partial<Patient> }>("/api/patients", { method: "POST", body: JSON.stringify(patient) }, "save");
export const updateMachine = (id: string, changes: Pick<Machine, "status"> & Partial<Pick<Machine, "notes" | "name">>) =>
  request(`/api/machines/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(changes) }, "save");
export const createMachine = (machine: { unitId: string; code: string; name: string; category: string; status: string; notes?: string }) =>
  request<{ machine: Record<string, unknown> }>("/api/machines", { method: "POST", body: JSON.stringify(machine) }, "save");
export const updateSession = (id: string, payload: { status: string; [key: string]: unknown }) =>
  request(`/api/sessions/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }, "save");
export const createSession = (session: { patientId: string; machineId: string; unitId: string; date: string; slot: string; status?: string; [key: string]: unknown }) =>
  request<{ session: { id: string } }>("/api/sessions", { method: "POST", body: JSON.stringify(session) }, "save");
export const markNotificationRead = (id: string, read: boolean) =>
  request(`/api/notifications/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ read }) }, "save");