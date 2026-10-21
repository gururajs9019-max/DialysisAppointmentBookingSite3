import { useMemo, useState } from "react";
import { FileText, Loader2, Search, X } from "lucide-react";
import type { AdminPrescription, Patient, RxDialysis } from "../../AdminApp";
import { createDoctorPrescription, type DoctorPrescriptionCreatePayload } from "../../lib/staffApi";
import { DIALYSIS_DAY_OPTIONS, DURATION_OPTIONS, SLOT_OPTIONS, WEEKLY_SESSION_OPTIONS } from "../../lib/prescription-utils";
import { useStaffDraftGuard } from "../../lib/useStaffDraftGuard";
import type { PrescriptionDraftStateListener } from "../../lib/usePrescriptionLeaveGuard";

interface Props {
  patients: Patient[];
  prescriptions: AdminPrescription[];
  audience: "doctor" | "administrator";
  onCancel: () => void;
  onCreated: (prescription: AdminPrescription) => void;
  onViewExisting: (prescription: AdminPrescription) => void;
  onDraftStateChange: PrescriptionDraftStateListener;
}

const inputClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
const labelClass = "mb-1 block text-xs font-semibold text-slate-600";

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function emptyDialysisRx(): RxDialysis {
  return {
    weeklySessionsCount: "",
    dialysisDays: [],
    slot: "",
    duration: "",
    bloodFlow: "",
    dialysateFlow: "",
    membrane: "",
    dryWeight: "",
    anticoagulation: "",
  };
}

export function DialysisPrescriptionCreateForm({
  patients,
  prescriptions,
  audience,
  onCancel,
  onCreated,
  onViewExisting,
  onDraftStateChange,
}: Props) {
  const [patientQuery, setPatientQuery] = useState("");
  const [patientId, setPatientId] = useState("");
  const [prescriptionDate, setPrescriptionDate] = useState(localDate);
  const [diagnosis, setDiagnosis] = useState("");
  const [dialysisRx, setDialysisRx] = useState<RxDialysis>(emptyDialysisRx);
  const [notes, setNotes] = useState("");
  const [requestId] = useState(() => crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedPatient = patients.find(patient => patient.id === patientId);
  const activePatients = useMemo(() => patients.filter(patient => patient.treatmentStatus === "Active"), [patients]);
  const matchingPatients = useMemo(() => {
    const query = patientQuery.trim().toLocaleLowerCase();
    if (!query) return [];
    return activePatients
      .filter(patient => [patient.name, patient.uhid, patient.id].some(value => value.toLocaleLowerCase().includes(query)))
      .slice(0, 8);
  }, [activePatients, patientQuery]);
  const patientHistory = useMemo(() => prescriptions
    .filter(prescription => prescription.patientId === patientId)
    .sort((a, b) => (a.createdAt || a.issuedDate).localeCompare(b.createdAt || b.issuedDate)), [prescriptions, patientId]);
  const isDirty = Boolean(patientId || diagnosis.trim() || notes.trim() || prescriptionDate !== localDate()
    || dialysisRx.weeklySessionsCount || dialysisRx.dialysisDays.length || dialysisRx.slot || dialysisRx.duration
    || dialysisRx.bloodFlow || dialysisRx.dialysateFlow || dialysisRx.membrane || dialysisRx.dryWeight || dialysisRx.anticoagulation);
  const draftGuard = useStaffDraftGuard(isDirty ? JSON.stringify({ patientId, prescriptionDate, diagnosis, dialysisRx, notes }) : null,
    saving, onDraftStateChange, "prescription");

  function closeForm() {
    if (draftGuard.confirmDiscard()) onCancel();
  }

  function updateScalar(key: Exclude<keyof RxDialysis, "dialysisDays">, value: string) {
    setDialysisRx(current => ({ ...current, [key]: value }));
  }

  function toggleDay(day: string) {
    setDialysisRx(current => ({
      ...current,
      dialysisDays: current.dialysisDays.includes(day)
        ? current.dialysisDays.filter(value => value !== day)
        : [...current.dialysisDays, day],
    }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!selectedPatient) {
      setError("Select a registered active patient before saving.");
      return;
    }
    if (!prescriptionDate) {
      setError("Enter a prescription date.");
      return;
    }
    if (!dialysisRx.weeklySessionsCount || !dialysisRx.dialysisDays.length || !dialysisRx.slot || !dialysisRx.duration) {
      setError("Enter the weekly schedule, dialysis days, slot, and session duration.");
      return;
    }

    const payload: DoctorPrescriptionCreatePayload = {
      medicationOrders: false,
      patientId,
      prescriptionDate,
      diagnosis: diagnosis.trim(),
      symptoms: "",
      investigationFindings: "",
      advice: "",
      dialysisRx,
      medications: [],
      dietaryAdvice: "",
      followUpDate: "",
      notes: notes.trim(),
    };

    setSaving(true);
    setError("");
    try {
      const saved = await createDoctorPrescription(requestId, payload);
      onCreated(saved);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Prescription could not be saved. Your entries are still here; try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm" aria-labelledby="create-dialysis-prescription-title">
      <div className="flex items-start justify-between gap-4 bg-gradient-to-r from-blue-700 to-blue-900 px-5 py-4 text-white sm:px-6">
        <div>
          <h2 id="create-dialysis-prescription-title" className="flex items-center gap-2 text-lg font-bold">
            <FileText className="h-5 w-5" /> Create Dialysis Prescription
          </h2>
          <p className="mt-1 text-sm text-blue-100">
            {audience === "administrator"
              ? "Enter the authorized dialysis prescription for an active patient."
              : "Enter the doctor-prescribed dialysis settings. Do not infer settings from a prior session."}
          </p>
        </div>
        <button type="button" onClick={closeForm} disabled={saving} aria-label="Close dialysis prescription form"
          className="rounded-lg p-2 text-blue-100 hover:bg-white/10 hover:text-white disabled:opacity-50">
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={event => void submit(event)} noValidate>
        <fieldset disabled={saving} className="space-y-6 p-5 sm:p-6">
          <section className="space-y-3" aria-labelledby="dialysis-prescription-patient">
            <h3 id="dialysis-prescription-patient" className="text-sm font-bold uppercase tracking-wide text-slate-700">Patient</h3>
            {!selectedPatient ? (
              <div className="relative">
                <label htmlFor="dialysis-prescription-patient-search" className={labelClass}>Search active patients by name or patient ID</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input id="dialysis-prescription-patient-search" value={patientQuery}
                    onChange={event => setPatientQuery(event.target.value)}
                    placeholder="Patient name, UHID, or record ID" autoComplete="off"
                    className={`${inputClass} pl-9`} aria-controls="dialysis-prescription-patient-results" />
                </div>
                {patientQuery.trim() && (
                  <div id="dialysis-prescription-patient-results" className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                    {matchingPatients.map(patient => (
                      <button type="button" key={patient.id} onClick={() => { setPatientId(patient.id); setPatientQuery(""); setError(""); }}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-blue-50">
                        <span className="font-semibold text-slate-800">{patient.name}</span>
                        <span className="ml-2 text-xs text-slate-500">{patient.uhid}</span>
                      </button>
                    ))}
                    {!matchingPatients.length && <p className="px-3 py-2 text-sm text-slate-500">No active patients found.</p>}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div>
                  <p className="font-semibold text-emerald-900">{selectedPatient.name}</p>
                  <p className="text-xs text-emerald-700">{selectedPatient.uhid}</p>
                </div>
                <button type="button" onClick={() => setPatientId("")} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">Change</button>
              </div>
            )}
            {patientHistory.length > 0 && (
              <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-800">Previous prescriptions</p>
                <div className="space-y-1.5">
                  {[...patientHistory].reverse().slice(0, 3).map(prescription => (
                    <button type="button" key={prescription.id} onClick={() => onViewExisting(prescription)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-left text-xs hover:bg-blue-100">
                      <span className="truncate font-semibold text-slate-700">{prescription.diagnosis || "Prescription"} · {prescription.issuedDate}</span>
                      <span className="shrink-0 text-blue-700">View</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="space-y-4" aria-labelledby="dialysis-prescription-details">
            <h3 id="dialysis-prescription-details" className="text-sm font-bold uppercase tracking-wide text-slate-700">Prescription details</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>Prescription date
                <input type="date" value={prescriptionDate} onChange={event => setPrescriptionDate(event.target.value)} className={inputClass} required />
              </label>
              <label className={labelClass}>Diagnosis <span className="font-normal">(optional)</span>
                <input value={diagnosis} onChange={event => setDiagnosis(event.target.value)} className={inputClass} maxLength={2000} />
              </label>
              <label className={labelClass}>Sessions per week
                <select value={dialysisRx.weeklySessionsCount} onChange={event => updateScalar("weeklySessionsCount", event.target.value)} className={inputClass} required>
                  <option value="">Select frequency</option>
                  {WEEKLY_SESSION_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className={labelClass}>Time slot
                <select value={dialysisRx.slot} onChange={event => updateScalar("slot", event.target.value)} className={inputClass} required>
                  <option value="">Select slot</option>
                  {SLOT_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className={labelClass}>Session duration
                <select value={dialysisRx.duration} onChange={event => updateScalar("duration", event.target.value)} className={inputClass} required>
                  <option value="">Select duration</option>
                  {DURATION_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className={labelClass}>Blood flow rate
                <input value={dialysisRx.bloodFlow} onChange={event => updateScalar("bloodFlow", event.target.value)} className={inputClass} maxLength={200} />
              </label>
              <label className={labelClass}>Dialysate flow rate
                <input value={dialysisRx.dialysateFlow} onChange={event => updateScalar("dialysateFlow", event.target.value)} className={inputClass} maxLength={200} />
              </label>
              <label className={labelClass}>Dialyzer / membrane
                <input value={dialysisRx.membrane} onChange={event => updateScalar("membrane", event.target.value)} className={inputClass} maxLength={200} />
              </label>
              <label className={labelClass}>Dry weight
                <input value={dialysisRx.dryWeight} onChange={event => updateScalar("dryWeight", event.target.value)} className={inputClass} maxLength={200} />
              </label>
              <label className={labelClass}>Anticoagulation
                <input value={dialysisRx.anticoagulation} onChange={event => updateScalar("anticoagulation", event.target.value)} className={inputClass} maxLength={500} />
              </label>
            </div>
            <fieldset>
              <legend className={labelClass}>Dialysis days</legend>
              <div className="flex flex-wrap gap-2">
                {DIALYSIS_DAY_OPTIONS.map(day => (
                  <button type="button" key={day} aria-pressed={dialysisRx.dialysisDays.includes(day)} onClick={() => toggleDay(day)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${dialysisRx.dialysisDays.includes(day) ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                    {day}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className={labelClass}>Additional instructions
              <textarea value={notes} onChange={event => setNotes(event.target.value)} className={`${inputClass} resize-y`} rows={3} maxLength={10000} />
            </label>
          </section>

          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={closeForm} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Saving…" : "Create Dialysis Prescription"}
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
