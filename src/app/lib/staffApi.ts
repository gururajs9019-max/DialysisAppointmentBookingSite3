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
  patient_id?: string | null;
  record_id?: string | null;
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

export interface PrescriptionMedicationDetails extends RxMedication {
  strength: string;
  duration: string;
  quantity: string;
  instructions: string;
}

export interface DoctorPrescriptionCreatePayload {
  medicationOrders: true;
  patientId: string;
  prescriptionDate: string;
  diagnosis: string;
  symptoms: string;
  investigationFindings: string;
  advice: string;
  medications: PrescriptionMedicationDetails[];
  dietaryAdvice: string;
  followUpDate: string;
  notes: string;
}

export class StaffApiError extends Error {
  constructor(message: string, public readonly operation: "load" | "save") {
    super(message);
    this.name = "StaffApiError";
  }
}

export class PrescriptionConflictError extends StaffApiError {
  constructor(message: string, public readonly currentVersion: number) {
    super(message, "save");
    this.name = "PrescriptionConflictError";
  }
}

export class ClinicalNoteConflictError extends StaffApiError {
  constructor(message: string, public currentVersion: number) {
    super(message, "save");
    this.name = "ClinicalNoteConflictError";
  }
}

async function request<T>(url: string, options: RequestInit = {}, operation: "load" | "save" = "load"): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options.headers } });
  } catch {
    throw new StaffApiError("The staff service is unavailable. Check your connection and try again.", operation);
  }
  const body = await response.json().catch(() => null) as { error?: string; code?: string; currentVersion?: number } | null;
  if (!response.ok) {
    if (response.status === 409 && body?.code === "CLINICAL_NOTE_VERSION_CONFLICT") {
      throw new ClinicalNoteConflictError(body.error || "This clinical note has a newer version.", body.currentVersion!);
    }
    if (response.status === 409 && body?.code === "PRESCRIPTION_VERSION_CONFLICT") {
      throw new PrescriptionConflictError(body.error || "This prescription has a newer version.", body.currentVersion!);
    }
    if (response.status === 401 || response.status === 403) clearPrescriptionHistoryCache();
    throw new StaffApiError(body?.error || `Staff request failed (${response.status}).`, operation);
  }
  if (operation === "save") {
    // Invalidate before notifying refresh listeners, including overlapping loads.
    if (options.method === "PATCH" && url.startsWith("/api/prescriptions/")) {
      prescriptionHistoryCache.delete(decodeURIComponent(url.slice("/api/prescriptions/".length)));
    }
    window.dispatchEvent(new Event("staff-data-changed"));
  }
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
  dateOfBirth: p.dateOfBirth || "", registrationFields: p.registrationFields || {},
  medicalInfo: p.medicalInfo || {}, investigations: p.investigations || {},
});

const asMachine = (m: Record<string, unknown>): Machine => ({
  id: String(m.id), number: String(m.code || m.name || ""), unit: String(m.unit_id || ""), category: String(m.category || "Negative"),
  name: String(m.name || m.code || ""), status: (m.status || "available") as Machine["status"],
  currentPatient: typeof m.current_patient === "string" ? m.current_patient : null,
  nextPatient: typeof m.next_patient === "string" ? m.next_patient : null,
  nextAvailableTime: typeof m.next_patient_date === "string" && typeof m.next_patient_slot === "string"
    ? `${m.next_patient_date.slice(0, 10)} · ${m.next_patient_slot}` : null,
  lastMaintenance: "", notes: String(m.notes || ""),
});

const asSession = (s: Record<string, unknown>): DialysisSession => {
  const rawStatus = String(s.status || "scheduled").toLowerCase();
  const statusMap: Record<string, DialysisSession["status"]> = {
    scheduled: "Scheduled", waiting: "Waiting", called: "Called", running: "Running", completed: "Completed",
    missed: "Missed", cancelled: "Cancelled",
  };
  const attendanceMap: Record<string, DialysisSession["attendance"]> = {
    scheduled: "Scheduled", waiting: "Scheduled", called: "Scheduled", running: "Scheduled", completed: "Completed",
    missed: "Missed", cancelled: "Cancelled",
  };
  const attendance = (attendanceMap[rawStatus] || "Scheduled") as DialysisSession["attendance"];
  return { id: String(s.id), patientId: String(s.patientId || ""), patientName: String(s.patientName || ""),
    uhid: String(s.uhid || ""), date: String(s.date || ""), slot: String(s.slot || ""), machine: String(s.machine || ""),
    machineId: String(s.machineId || ""), unit: String(s.unitId || s.unit || ""), duration: String(s.duration || ""), doctor: String(s.doctor || ""),
    attendance, doctorId: typeof s.doctorId === "string" ? s.doctorId : undefined,
    prescriptionId: typeof s.prescriptionId === "string" ? s.prescriptionId : undefined,
    notes: String(s.notes || ""), startTime: String(s.startTime || ""), endTime: String(s.endTime || ""),
    vitals: s.vitals as DialysisSession["vitals"], complications: s.complications as string[] | undefined,
    importantNote: typeof s.importantNote === "string" ? s.importantNote : undefined,
    slotType: s.slotType as DialysisSession["slotType"], emergencyTime: s.emergencyTime as string | undefined,
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
      ...Object.fromEntries(["strength", "duration", "quantity", "instructions"]
        .filter(key => typeof med[key] === "string" && med[key])
        .map(key => [key, med[key]])),
    })) as RxMedication[];
}

const asPrescription = (p: Record<string, any>): AdminPrescription => ({
  id: p.id, patientId: p.patientId, patientName: p.patientName || "", patientUhid: p.patientUhid || "",
  diagnosis: p.diagnosis || "", status: p.status || "Active", issuedDate: p.createdAt || "", updatedBy: p.updatedBy || "Staff",
  updatedByRole: p.updatedByRole || "Doctor", lastUpdatedAt: p.updatedAt, dialysisRx: asDialysisRx(p.dialysisRx),
  medications: asMedications(p.medications), notes: p.notes || "", history: [],
  prescriptionDate: asText(p.prescriptionDate),
  symptoms: asText(p.symptoms),
  investigationFindings: asText(p.investigationFindings),
  advice: asText(p.advice),
  dietaryAdvice: asText(p.dietaryAdvice),
  followUpDate: asText(p.followUpDate),
  version: Number(p.version) || 1, createdAt: p.createdAt, createdBy: p.createdBy || p.updatedBy || "Staff",
  createdByRole: p.createdByRole || p.updatedByRole || "Doctor",
}) as AdminPrescription;

const asHistory = (row: Record<string, any>): AdminPrescription["history"][number] => {
  const snapshot = row.snapshot || {};
  return {
    version: row.version, updatedDate: row.created_at || "", updatedAt: row.created_at,
    updatedBy: row.changed_by_name || "Staff", updatedByRole: row.changed_by_role || "Doctor", changedFields: [],
    dialysisRx: asDialysisRx(snapshot.dialysisRx), medications: asMedications(snapshot.medications),
    notes: snapshot.notes || "", status: snapshot.status || "Active",
  } as AdminPrescription["history"][number];
};

type PrescriptionHistory = AdminPrescription["history"];
const prescriptionHistoryCache = new Map<string, { version: number; history: Promise<PrescriptionHistory> }>();

// Staff login/logout starts a new cache lifetime; histories never persist to disk.
export function clearPrescriptionHistoryCache(): void {
  prescriptionHistoryCache.clear();
}

export async function fetchPrescriptions(): Promise<AdminPrescription[]> {
  const result = await request<{ prescriptions: Record<string, any>[] }>("/api/prescriptions");
  const prescriptions = result.prescriptions.map(asPrescription);
  const ids = new Set(prescriptions.map(prescription => prescription.id));
  for (const id of prescriptionHistoryCache.keys()) {
    if (!ids.has(id)) prescriptionHistoryCache.delete(id);
  }

  const pending: Array<{
    prescription: AdminPrescription;
    entry: { version: number; history: Promise<PrescriptionHistory> };
    resolve: (history: PrescriptionHistory) => void;
    reject: (reason: unknown) => void;
  }> = [];
  const historyPromises = new Map<string, Promise<PrescriptionHistory>>();
  for (const prescription of prescriptions) {
    const version = prescription.version || 1;
    const cached = prescriptionHistoryCache.get(prescription.id);
    if (cached?.version === version) {
      historyPromises.set(prescription.id, cached.history);
      continue;
    }

    let resolve!: (history: PrescriptionHistory) => void;
    let reject!: (reason: unknown) => void;
    const history = new Promise<PrescriptionHistory>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    const entry = { version, history };
    prescriptionHistoryCache.set(prescription.id, entry);
    // Failed batches are retried, and an older response cannot evict a newer
    // revision's in-flight entry.
    history.catch(() => {
      if (prescriptionHistoryCache.get(prescription.id) === entry) {
        prescriptionHistoryCache.delete(prescription.id);
      }
    });
    pending.push({ prescription, entry, resolve, reject });
    historyPromises.set(prescription.id, history);
  }

  if (pending.length) {
    // Bound both query size and concurrency for very large first-time loads.
    const batches: Array<typeof pending> = [];
    for (let offset = 0; offset < pending.length; offset += 500) batches.push(pending.slice(offset, offset + 500));
    let nextBatch = 0;
    let failed = false;
    const loadBatches = async () => {
      while (!failed && nextBatch < batches.length) {
        const batch = batches[nextBatch++];
        try {
          const result = await request<{ histories: Array<{ prescriptionId: string; history: Record<string, any>[] }> }>(
            "/api/prescription-histories",
            {
              method: "POST",
              body: JSON.stringify({
                prescriptions: batch.map(({ prescription, entry }) => ({
                  id: prescription.id, version: entry.version,
                })),
              }),
            },
          );
          if (!Array.isArray(result.histories)) throw new StaffApiError("Prescription history response was invalid.", "load");
          const byId = new Map<string, Record<string, any>[]>(result.histories.map(item => [item.prescriptionId, item.history]));
          if (batch.some(({ prescription }) => !Array.isArray(byId.get(prescription.id)))) {
            throw new StaffApiError("Prescription history response was incomplete.", "load");
          }
          for (const { prescription, entry, resolve } of batch) {
            resolve(byId.get(prescription.id)!
              .filter(row => Number(row.version) < entry.version)
              .map(asHistory)
              .sort((a, b) => b.version - a.version));
          }
        } catch (error) {
          failed = true;
          throw error;
        }
      }
    };
    Promise.all(Array.from({ length: Math.min(2, batches.length) }, loadBatches)).catch(error => {
      for (const item of pending) item.reject(error);
    });
  }

  await Promise.all(prescriptions.map(async prescription => {
    const history = historyPromises.get(prescription.id);
    if (!history) throw new StaffApiError("Prescription history was not loaded.", "load");
    // Keep cached snapshots isolated from form drafts and comparison views.
    prescription.history = structuredClone(await history);
  }));
  return prescriptions;
}

export async function fetchPatientById(id: string): Promise<Patient> {
  const result = await request<{ patient: Partial<Patient> }>(`/api/patients/${encodeURIComponent(id)}`);
  return asPatient(result.patient);
}

export async function createPrescription(patientId: string, prescription: AdminPrescription): Promise<AdminPrescription> {
  await request("/api/prescriptions", {
    method: "POST",
    body: JSON.stringify({
      patientId,
      diagnosis: prescription.diagnosis,
      dialysisRx: prescription.dialysisRx,
      medications: prescription.medications,
      notes: prescription.notes,
      status: "Active",
    }),
  }, "save");
  const refreshed = await fetchPrescriptions();
  const saved = refreshed.find(item => item.patientId === patientId);
  if (!saved) throw new StaffApiError("The new prescription could not be reloaded.", "load");
  return saved;
}

export async function createDoctorPrescription(
  requestId: string,
  prescription: DoctorPrescriptionCreatePayload,
): Promise<AdminPrescription> {
  const result = await request<{ prescription: { id: string } }>("/api/prescriptions", {
    method: "POST",
    body: JSON.stringify({ ...prescription, requestId }),
  }, "save");
  const saved = (await fetchPrescriptions()).find(item => item.id === result.prescription.id);
  if (!saved) throw new StaffApiError("The new prescription could not be reloaded.", "load");
  return saved;
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
    baseVersion: prescription.version,
    diagnosis: prescription.diagnosis, dialysisRx: prescription.dialysisRx, medications: prescription.medications,
    notes: prescription.notes, status: "Revised",
  }) }, "save");
  const refreshed = await fetchPrescriptions();
  const saved = refreshed.find(item => item.id === id);
  if (!saved) throw new StaffApiError("The saved prescription could not be reloaded.", "load");
  return saved;
}

export interface ClinicalNoteDto { id: string; patient_id: string; version: number; body: string; created_at: string; updated_at?: string; author_name?: string; data?: { title?: string; noteType?: string; vitals?: Record<string,string> }; }
export const fetchClinicalNotes = (patientId: string) => request<{ notes: ClinicalNoteDto[] }>(`/api/patients/${encodeURIComponent(patientId)}/clinical-notes`);
export const fetchAllClinicalNotes = () => request<{ notes: ClinicalNoteDto[] }>("/api/clinical-notes");
export const createClinicalNote = (patientId: string, body: string, data?: ClinicalNoteDto["data"]) => request<{ note: ClinicalNoteDto }>("/api/clinical-notes", { method: "POST", body: JSON.stringify({ patientId, body, data }) }, "save");
export const updateClinicalNote = (id: string, baseVersion: number, body: string, data?: ClinicalNoteDto["data"]) => request<{ note: ClinicalNoteDto }>(`/api/clinical-notes/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ baseVersion, body, data }) }, "save");
export const updatePatient = async (id: string, changes: Partial<Patient>) => {
  const r = await request<{ patient: Partial<Patient> }>(`/api/patients/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(changes) }, "save");
  return asPatient(r.patient);
};
export interface StaffAccount {
  id: string; name: string; email: string; role: string; status: "Active" | "Inactive";
  employeeId: string; specialization: string; phone: string; dateAdded: string; hasHistoricalRecords: boolean;
}
export const fetchStaffAccounts = () => request<{users: StaffAccount[]}>("/api/users");
export const createStaffAccount = (data: Record<string,unknown>) => request<{user: StaffAccount}>("/api/users", {method:"POST",body:JSON.stringify(data)}, "save");
export const updateStaffAccount = (id: string, data: Record<string,unknown>) => request<{user: StaffAccount}>(`/api/users/${encodeURIComponent(id)}`, {method:"PATCH",body:JSON.stringify(data)}, "save");

export const createPatient = async (patient: Record<string, unknown>) => {
  const result = await request<{ patient: Partial<Patient> }>("/api/patients", { method: "POST", body: JSON.stringify(patient) }, "save");
  return { patient: asPatient(result.patient) };
};
export const updateMachine = (id: string, changes: Pick<Machine, "status"> & Partial<Pick<Machine, "notes" | "name">>) =>
  request(`/api/machines/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(changes) }, "save");
export const createMachine = (machine: { unitId: string; code: string; name: string; category: string; status: string; notes?: string }) =>
  request<{ machine: Record<string, unknown> }>("/api/machines", { method: "POST", body: JSON.stringify(machine) }, "save");
export type SessionUpdatePayload = {
  status: "scheduled" | "waiting" | "called" | "running" | "completed" | "missed" | "cancelled";
  missedReason?: string;
  missedReasonOther?: string;
  machineId?: string;
  unitId?: string;
  date?: string;
  slot?: string;
  slotType?: "normal" | "emergency";
  emergencyTime?: string;
  startTime?: string;
  endTime?: string;
  duration?: string;
  [key: string]: unknown;
};
export type SchedulingOptions = {
  doctors: { id: string; name: string }[];
  prescriptions: { id: string; diagnosis: string | null; version: number; prescribedSlot: string | null }[];
};
export const fetchSchedulingOptions = (patientId?: string) =>
  request<SchedulingOptions>(`/api/scheduling-options?patientId=${encodeURIComponent(patientId || "")}`);
export const updateSession = async (id: string, payload: SessionUpdatePayload) => {
  const result = await request<{ session: Record<string, unknown>; machine?: Record<string, unknown>; machines?: Record<string, unknown>[] }>(
    `/api/sessions/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(payload) },
    "save",
  );
  return {
    session: asSession(result.session),
    machine: result.machine ? asMachine(result.machine) : undefined,
    machines: result.machines?.map(asMachine),
  };
};
export const createSession = async (session: { patientId: string; machineId: string; unitId: string; date: string; slot: string; status?: string; [key: string]: unknown }) => {
  const result = await request<{ session: Record<string, unknown> }>(
    "/api/sessions", { method: "POST", body: JSON.stringify(session) }, "save",
  );
  return { session: asSession(result.session) };
};
export const markNotificationRead = (id: string, read: boolean) =>
  request<{ notification: StaffNotification }>(`/api/notifications/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ read }) }, "save");

export const markAllNotificationsRead = () =>
  request<{ ids: string[] }>("/api/notifications/read-all", { method: "PATCH" }, "save");

export const openNotificationTarget = (id: string) =>
  request<{ patientId: string; prescriptionId: string }>(`/api/notifications/${encodeURIComponent(id)}/target`);