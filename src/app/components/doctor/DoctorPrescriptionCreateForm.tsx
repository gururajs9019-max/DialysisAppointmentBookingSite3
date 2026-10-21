import { useMemo, useState } from "react";
import { CalendarDays, FileText, Loader2, Pill, Plus, Search, Trash2, UserRound, X } from "lucide-react";
import type { AdminPrescription, Patient } from "../../AdminApp";
import { createDoctorPrescription, type DoctorPrescriptionCreatePayload, type PrescriptionMedicationDetails } from "../../lib/staffApi";
import { useStaffDraftGuard } from "../../lib/useStaffDraftGuard";
import type { PrescriptionDraftStateListener } from "../../lib/usePrescriptionLeaveGuard";

interface DoctorPrescriptionDetails extends AdminPrescription {
  prescriptionDate?: string;
}

interface DoctorPrescriptionCreateFormProps {
  patients: Patient[];
  prescriptions: AdminPrescription[];
  audience?: "doctor" | "administrator";
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

function emptyMedication(): PrescriptionMedicationDetails {
  return { name: "", strength: "", dose: "", route: "", frequency: "", duration: "", quantity: "", instructions: "" };
}

function chronologyDate(prescription: AdminPrescription) {
  const extended = prescription as DoctorPrescriptionDetails;
  return extended.prescriptionDate || prescription.createdAt || prescription.issuedDate || "";
}

function displayDate(value: string) {
  if (!value) return "Date not recorded";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function DoctorPrescriptionCreateForm({
  patients,
  prescriptions,
  audience = "doctor",
  onCancel,
  onCreated,
  onViewExisting,
  onDraftStateChange,
}: DoctorPrescriptionCreateFormProps) {
  const [patientQuery, setPatientQuery] = useState("");
  const [patientId, setPatientId] = useState("");
  const [prescriptionDate, setPrescriptionDate] = useState(localDate);
  const [diagnosis, setDiagnosis] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [investigationFindings, setInvestigationFindings] = useState("");
  const [advice, setAdvice] = useState("");
  const [medications, setMedications] = useState<PrescriptionMedicationDetails[]>([emptyMedication()]);
  const [dietaryAdvice, setDietaryAdvice] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
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
    .sort((a, b) => chronologyDate(a).localeCompare(chronologyDate(b))), [prescriptions, patientId]);

  const isDirty = Boolean(
    patientId || diagnosis.trim() || symptoms.trim() || investigationFindings.trim() || advice.trim()
    || dietaryAdvice.trim() || followUpDate || notes.trim()
    || medications.some(medication => Object.values(medication).some(value => value.trim())),
  );
  const draftGuard = useStaffDraftGuard(isDirty ? JSON.stringify({
    patientId, prescriptionDate, diagnosis, symptoms, investigationFindings, advice, medications, dietaryAdvice, followUpDate, notes,
  }) : null, saving, onDraftStateChange, "prescription");

  function closeForm() {
    if (draftGuard.confirmDiscard()) onCancel();
  }

  function selectPatient(patient: Patient) {
    setPatientId(patient.id);
    setPatientQuery("");
    setError("");
  }

  function updateMedication(index: number, field: keyof PrescriptionMedicationDetails, value: string) {
    setMedications(current => current.map((medication, itemIndex) =>
      itemIndex === index ? { ...medication, [field]: value } : medication,
    ));
  }

  function validate() {
    if (!selectedPatient) return "Select a registered active patient before saving.";
    if (!prescriptionDate) return "Enter a prescription date.";
    if (!diagnosis.trim()) return "Enter a diagnosis.";
    if (!medications.length) return "Add at least one medicine.";
    if (medications.some(medication => !medication.name.trim())) return "Enter a medicine name for each medication row, or remove an unused row.";
    return "";
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload: DoctorPrescriptionCreatePayload = {
      medicationOrders: true,
      patientId,
      prescriptionDate,
      diagnosis: diagnosis.trim(),
      symptoms: symptoms.trim(),
      investigationFindings: investigationFindings.trim(),
      advice: advice.trim(),
      medications: medications.map(medication => ({
        name: medication.name.trim(),
        strength: medication.strength.trim(),
        dose: medication.dose.trim(),
        route: medication.route.trim(),
        frequency: medication.frequency.trim(),
        duration: medication.duration.trim(),
        quantity: medication.quantity.trim(),
        instructions: medication.instructions.trim(),
      })),
      dietaryAdvice: dietaryAdvice.trim(),
      followUpDate,
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
    <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm" aria-labelledby="create-prescription-title">
      <div className="flex items-start justify-between gap-4 bg-gradient-to-r from-blue-700 to-blue-900 px-5 py-4 text-white sm:px-6">
        <div>
          <h2 id="create-prescription-title" className="flex items-center gap-2 text-lg font-bold">
            <FileText className="h-5 w-5" /> Create Prescription
          </h2>
          <p className="mt-1 text-sm text-blue-100">{audience === "administrator"
            ? "Create a prescription for an existing active patient using authorized clinical instructions."
            : "Use an existing patient record. Clinical decisions and medicine orders must be entered by the doctor."}</p>
        </div>
        <button type="button" onClick={closeForm} disabled={saving} aria-label="Close prescription form"
          className="rounded-lg p-2 text-blue-100 hover:bg-white/10 hover:text-white disabled:opacity-50">
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={submit} noValidate>
        <fieldset disabled={saving} className="space-y-6 p-5 sm:p-6">
          <section aria-labelledby="prescription-patient-title" className="space-y-3">
            <h3 id="prescription-patient-title" className="text-sm font-bold uppercase tracking-wide text-slate-700">Patient</h3>
            {!selectedPatient ? (
              <div className="relative">
                <label htmlFor="prescription-patient-search" className={labelClass}>Search registered patients by name or patient ID</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input id="prescription-patient-search" value={patientQuery}
                    onChange={event => setPatientQuery(event.target.value)}
                    placeholder="Patient name, UHID, or record ID" autoComplete="off"
                    className={`${inputClass} pl-9`} aria-controls="prescription-patient-results" />
                </div>
                {patientQuery.trim() && (
                  <div id="prescription-patient-results" className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                    {matchingPatients.map(patient => (
                      <button key={patient.id} type="button" onClick={() => selectPatient(patient)}
                        className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-blue-50">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-800">{patient.name}</span>
                          <span className="block text-xs text-slate-500">Patient ID (UHID): {patient.uhid}</span>
                        </span>
                        <span className="shrink-0 text-xs font-medium text-blue-700">Select</span>
                      </button>
                    ))}
                    {!matchingPatients.length && (
                      <p className="px-4 py-3 text-sm text-slate-500">
                        No active registered patients match. Patient records are not created from this form.
                      </p>
                    )}
                  </div>
                )}
                {!patientQuery.trim() && !activePatients.length && (
                  <p className="mt-2 text-sm text-amber-700">There are no active registered patients available for a new prescription.</p>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="rounded-xl bg-white p-2 text-blue-700"><UserRound className="h-5 w-5" /></span>
                    <div>
                      <p className="font-semibold text-slate-900">{selectedPatient.name}</p>
                      <p className="mt-0.5 text-sm text-slate-600">Patient ID (UHID): {selectedPatient.uhid}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Age: {selectedPatient.age > 0 ? selectedPatient.age : "Not recorded"}
                        {" · "}Gender: {selectedPatient.gender || "Not recorded"}
                      </p>
                    </div>
                  </div>
                  <button type="button" onClick={() => { setPatientId(""); setPatientQuery(""); }}
                    className="text-xs font-semibold text-blue-700 hover:text-blue-900">Change patient</button>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="prescription-date" className={labelClass}>Prescription date</label>
                    <input id="prescription-date" type="date" required value={prescriptionDate}
                      onChange={event => setPrescriptionDate(event.target.value)} className={inputClass} />
                  </div>
                  <div className="flex items-end gap-2 rounded-lg bg-white/70 p-3 text-xs text-slate-600">
                    <CalendarDays className="h-4 w-4 shrink-0 text-blue-600" />
                    The patient details shown here come from the registered patient record.
                  </div>
                </div>
              </div>
            )}
          </section>

          {selectedPatient && patientHistory.length > 0 && (
            <section aria-labelledby="prior-prescriptions-title" className="rounded-xl border border-slate-200 p-4">
              <h3 id="prior-prescriptions-title" className="text-sm font-bold text-slate-800">Previous prescriptions for {selectedPatient.name}</h3>
              <p className="mt-1 text-xs text-slate-500">History is preserved. This form will create a separate prescription.</p>
              <ol className="mt-3 space-y-2">
                {patientHistory.map(prescription => (
                  <li key={prescription.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{prescription.diagnosis || "Prescription"} <span className="font-normal text-slate-500">· {prescription.status}</span></p>
                      <p className="text-xs text-slate-500">
                        {displayDate(chronologyDate(prescription))} · Prescribed by {prescription.createdBy || prescription.updatedBy || "Staff"}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-600">
                        {prescription.medications.map(medication => medication.name).filter(Boolean).join(", ") || "No medication summary"}
                      </p>
                    </div>
                    <button type="button" onClick={() => {
                      if (draftGuard.confirmDiscard()) onViewExisting(prescription);
                    }} className="shrink-0 text-xs font-semibold text-blue-700 hover:text-blue-900">
                      View details
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {selectedPatient && patientHistory.length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
              No previous prescriptions are recorded for this patient. This will be a new record.
            </p>
          )}

          {selectedPatient && (
            <>
              <section className="space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Clinical information</h3>
                <div>
                  <label htmlFor="prescription-diagnosis" className={labelClass}>Diagnosis <span className="text-red-600">*</span></label>
                  <input id="prescription-diagnosis" required value={diagnosis} onChange={event => setDiagnosis(event.target.value)}
                    maxLength={2000} placeholder="Enter diagnosis" className={inputClass} />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label htmlFor="prescription-symptoms" className={labelClass}>Symptoms or clinical notes</label>
                    <textarea id="prescription-symptoms" rows={3} value={symptoms} onChange={event => setSymptoms(event.target.value)}
                      maxLength={5000} className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="prescription-investigations" className={labelClass}>Investigation findings</label>
                    <textarea id="prescription-investigations" rows={3} value={investigationFindings}
                      onChange={event => setInvestigationFindings(event.target.value)} maxLength={5000} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label htmlFor="prescription-advice" className={labelClass}>Doctor's advice</label>
                  <textarea id="prescription-advice" rows={2} value={advice} onChange={event => setAdvice(event.target.value)}
                    maxLength={5000} className={inputClass} />
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
                    <Pill className="h-4 w-4 text-violet-600" /> Medication orders <span className="text-red-600">*</span>
                  </h3>
                  <button type="button" onClick={() => setMedications(current => [...current, emptyMedication()])}
                    className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">
                    <Plus className="h-3.5 w-3.5" /> Add Medicine
                  </button>
                </div>
                {medications.map((medication, index) => (
                  <fieldset key={index} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                    <legend className="px-1 text-xs font-semibold text-slate-500">Medicine {index + 1}</legend>
                    <div className="mb-3 flex justify-end">
                      <button type="button" disabled={medications.length === 1}
                        onClick={() => setMedications(current => current.filter((_, itemIndex) => itemIndex !== index))}
                        aria-label={`Remove medicine ${index + 1}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:text-slate-300">
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {([
                        ["name", "Medicine name", true],
                        ["strength", "Strength", false],
                        ["dose", "Dose", false],
                        ["route", "Route", false],
                        ["frequency", "Frequency", false],
                        ["duration", "Duration", false],
                        ["quantity", "Quantity", false],
                        ["instructions", "Additional instructions", false],
                      ] as const).map(([field, label, required]) => (
                        <div key={field} className={field === "instructions" ? "sm:col-span-2 lg:col-span-4" : ""}>
                          <label htmlFor={`medicine-${index}-${field}`} className={labelClass}>
                            {label}{required && <span className="text-red-600"> *</span>}
                          </label>
                          <input id={`medicine-${index}-${field}`} required={required}
                            value={medication[field]} maxLength={field === "instructions" ? 2000 : field === "name" ? 300 : ["route", "quantity"].includes(field) ? 100 : 200}
                            onChange={event => updateMedication(index, field, event.target.value)}
                            placeholder={label} className={inputClass} />
                        </div>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Additional instructions</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label htmlFor="prescription-dietary" className={labelClass}>Dietary advice</label>
                    <textarea id="prescription-dietary" rows={2} value={dietaryAdvice}
                      onChange={event => setDietaryAdvice(event.target.value)} maxLength={5000} className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="prescription-follow-up" className={labelClass}>Follow-up date</label>
                    <input id="prescription-follow-up" type="date" value={followUpDate}
                      onChange={event => setFollowUpDate(event.target.value)} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label htmlFor="prescription-notes" className={labelClass}>Additional notes</label>
                  <textarea id="prescription-notes" rows={3} value={notes}
                    onChange={event => setNotes(event.target.value)} maxLength={10000} className={inputClass} />
                </div>
              </section>
            </>
          )}

          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

          <div className="flex flex-col-reverse justify-end gap-2 border-t border-slate-100 pt-4 sm:flex-row">
            <button type="button" onClick={closeForm} disabled={saving}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><FileText className="h-4 w-4" /> Save Prescription</>}
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
