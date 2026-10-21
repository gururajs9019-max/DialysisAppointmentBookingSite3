import React, { useEffect, useRef, useState } from "react";
import { FileText, Plus, Search, ChevronDown, ChevronUp, Edit2, Check, X, User, Pill, Clock, AlertTriangle, ScrollText, Trash2 } from "lucide-react";
import type { AdminPrescription, Patient, RxDialysis, RxMedication, RxNotification } from "../../AdminApp";
import { updatePrescription, PrescriptionConflictError, type DoctorPrescriptionCreatePayload, type PrescriptionMedicationDetails } from "../../lib/staffApi";
import {
  DIALYSIS_DAY_OPTIONS, SLOT_OPTIONS, DURATION_OPTIONS, weeklySessionsCountFromDays,
} from "../../lib/prescription-utils";
import { PrescriptionConflict } from "../PrescriptionConflict";
import { usePrescriptionDraftGuard, type PrescriptionDraftStateListener } from "../../lib/usePrescriptionLeaveGuard";
import { DoctorPrescriptionCreateForm } from "./DoctorPrescriptionCreateForm";
import { DialysisPrescriptionCreateForm } from "./DialysisPrescriptionCreateForm";

interface DoctorPrescriptionProps {
  onNavigate: (view: string) => void;
  patients: Patient[];
  prescriptions: AdminPrescription[];
  setPrescriptions: React.Dispatch<React.SetStateAction<AdminPrescription[]>>;
  doctorName: string;
  addRxNotification: (n: Omit<RxNotification, "id" | "read">) => void;
  onDraftStateChange: PrescriptionDraftStateListener;
  targetPatientId?: string | null;
  targetPrescriptionId?: string | null;
  isAdmin?: boolean;
}

const RX_SCALAR_FIELDS: { key: keyof Omit<RxDialysis, "dialysisDays">; label: string }[] = [
  { key: "weeklySessionsCount", label: "Weekly Sessions" },
  { key: "slot",                label: "Slot" },
  { key: "duration",            label: "Duration" },
  { key: "bloodFlow",           label: "Blood Flow" },
  { key: "dialysateFlow",       label: "Dialysate Flow" },
  { key: "membrane",            label: "Membrane" },
  { key: "dryWeight",           label: "Dry Weight" },
  { key: "anticoagulation",     label: "Anticoagulation" },
];

function StatusBadge({ status }: { status: AdminPrescription["status"] }) {
  const map = {
    Active:       "bg-emerald-100 text-emerald-700 border-emerald-200",
    Revised:      "bg-amber-100 text-amber-700 border-amber-200",
    Discontinued: "bg-red-100 text-red-700 border-red-200",
  };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${map[status]}`}>{status}</span>;
}

type PrescriptionDetails = AdminPrescription & Partial<Omit<DoctorPrescriptionCreatePayload, "patientId" | "medications">>;

function prescriptionKinds(prescription: AdminPrescription) {
  const details = prescription as PrescriptionDetails;
  const hasMedical = details.medicationOrders === true || prescription.medications?.length > 0;
  const hasDialysis = Object.values(prescription.dialysisRx ?? {}).some(value =>
    Array.isArray(value) ? value.length > 0 : Boolean(value),
  );
  return { medical: hasMedical, dialysis: hasDialysis || !hasMedical };
}

export function DoctorPrescription({
  onNavigate: _onNavigate,
  patients,
  prescriptions,
  setPrescriptions,
  onDraftStateChange,
  targetPatientId,
  targetPrescriptionId,
  isAdmin = false,
}: DoctorPrescriptionProps) {
  const [search, setSearch] = useState(() => prescriptions.find(rx => rx.id === targetPrescriptionId)?.patientUhid ?? "");
  const [typeFilter, setTypeFilter] = useState<"All" | "Medical" | "Dialysis">("All");
  const [expanded, setExpanded] = useState<string | null>(targetPrescriptionId ?? prescriptions[0]?.id ?? null);
  const [showNew, setShowNew] = useState(false);
  const [newPrescriptionKind, setNewPrescriptionKind] = useState<"medical" | "dialysis" | null>(null);
  const [creationSuccess, setCreationSuccess] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<AdminPrescription | null>(null);
  const [showHistoryFor, setShowHistoryFor] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState("");
  const [conflict, setConflict] = useState(false);
  const [savingRx, setSavingRx] = useState(false);
  const draftGuard = usePrescriptionDraftGuard(editDraft, savingRx, onDraftStateChange);
  const initializedTarget = useRef<string | null>(null);

  useEffect(() => {
    if (!targetPatientId || !targetPrescriptionId) {
      initializedTarget.current = null;
      return;
    }
    const targetKey = `${targetPatientId}:${targetPrescriptionId}`;
    if (initializedTarget.current === targetKey) return;
    const prescription = prescriptions.find(rx => rx.id === targetPrescriptionId);
    const patient = patients.find(item => item.id === targetPatientId);
    if (!prescription && !patient) return;
    initializedTarget.current = targetKey;
    setSearch(prescription?.patientUhid ?? patient?.uhid ?? "");
    setExpanded(targetPrescriptionId);
  }, [targetPatientId, targetPrescriptionId, patients, prescriptions]);

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filtered = prescriptions.filter(rx => {
    const kinds = prescriptionKinds(rx);
    const matchesType = typeFilter === "All" || (typeFilter === "Medical" ? kinds.medical : kinds.dialysis);
    return (!normalizedSearch || [rx.patientName, rx.patientUhid, rx.patientId, rx.id]
      .some(value => value.toLocaleLowerCase().includes(normalizedSearch)))
      && matchesType;
  }).sort((a, b) => (b.createdAt || b.issuedDate).localeCompare(a.createdAt || a.issuedDate));

  function startCreate() {
    if (!draftGuard.confirmDiscard()) return;
    setEditingId(null); setEditDraft(null); setConflict(false); setSaveError(null); setSaveSuccess("");
    setCreationSuccess(false); setNewPrescriptionKind(null); setShowNew(true);
  }

  function startEdit(rx: AdminPrescription) {
    if (!draftGuard.confirmDiscard()) return;
    draftGuard.beginDraft(rx);
    setConflict(false); setSaveError(null); setSaveSuccess("");
    setEditDraft(JSON.parse(JSON.stringify(rx)));
    setEditingId(rx.id);
    setShowHistoryFor(null);
  }

  function cancelEdit() {
    if (!draftGuard.confirmDiscard()) return;
    setEditingId(null); setEditDraft(null); setConflict(false); setSaveError(null); setSaveSuccess("");
  }

  async function saveEdit() {
    if (!editDraft || savingRx || conflict) return;
    const original = prescriptions.find(p => p.id === editDraft.id);
    if (!original) return;
    setSavingRx(true);
    try {
      setSaveError(null);
      const hasDialysisPrescription = prescriptionKinds(editDraft).dialysis;
      const draftToSave = hasDialysisPrescription
        ? { ...editDraft, dialysisRx: {
          ...editDraft.dialysisRx,
          weeklySessionsCount: weeklySessionsCountFromDays(editDraft.dialysisRx.dialysisDays),
        } }
        : editDraft;
      const saved = await updatePrescription(editDraft.id, draftToSave);
      setPrescriptions(prev => prev.map(rx => rx.id === saved.id ? saved : rx));
    } catch (error) {
      if (error instanceof PrescriptionConflictError) setConflict(true);
      setSaveError(error instanceof Error ? error.message : "Prescription could not be saved.");
      return;
    } finally { setSavingRx(false); }
    setEditingId(null);
    setEditDraft(null);
    setSaveSuccess("Prescription changes saved successfully.");
  }

  function updateRxScalar(key: keyof Omit<RxDialysis, "dialysisDays">, value: string) {
    if (!editDraft) return;
    setEditDraft({ ...editDraft, dialysisRx: { ...editDraft.dialysisRx, [key]: value } });
  }

  function toggleDay(day: string) {
    if (!editDraft) return;
    const days = editDraft.dialysisRx.dialysisDays.includes(day)
      ? editDraft.dialysisRx.dialysisDays.filter(d => d !== day)
      : [...editDraft.dialysisRx.dialysisDays, day];
    setEditDraft({ ...editDraft, dialysisRx: { ...editDraft.dialysisRx, dialysisDays: days } });
  }

  function addMedRow() {
    if (!editDraft) return;
    setEditDraft({ ...editDraft, medications: [...editDraft.medications, {
      name: "", strength: "", dose: "", frequency: "", route: "PO", duration: "", quantity: "", instructions: "",
    }] });
  }

  function removeMedRow(idx: number) {
    if (!editDraft) return;
    setEditDraft({ ...editDraft, medications: editDraft.medications.filter((_, i) => i !== idx) });
  }

  function updateMed(idx: number, field: keyof RxMedication, value: string) {
    if (!editDraft) return;
    const meds = editDraft.medications.map((m, i) => i === idx ? { ...m, [field]: value } : m);
    setEditDraft({ ...editDraft, medications: meds });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl shadow-lg p-6 text-white">
        <h1 className="text-2xl md:text-3xl font-bold mb-1">{isAdmin ? "Prescription Management" : "Prescriptions"}</h1>
        <p className="text-blue-100 text-sm">{isAdmin
          ? "Search, review, create, and revise patient medical and dialysis prescriptions."
          : "Manage dialysis prescriptions and medication orders for your patients."}</p>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by patient name or UHID…"
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm bg-white"
          />
        </div>
        <button
          onClick={startCreate}
          disabled={showNew || savingRx}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold text-sm shadow-md shadow-blue-200 shrink-0"
        >
          <Plus className="w-4 h-4" /> Create Prescription
        </button>
      </div>
      <div className="grid max-w-sm gap-3">
        <label className="text-xs font-semibold text-slate-600">Prescription type
          <select value={typeFilter} onChange={event => setTypeFilter(event.target.value as typeof typeFilter)}
            className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-700">
            <option>All</option><option>Medical</option><option>Dialysis</option>
          </select>
        </label>
      </div>

      {creationSuccess && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
        Prescription created successfully.
      </p>}
      {saveSuccess && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
        {saveSuccess}
      </p>}

      {showNew && !newPrescriptionKind && (
        <section aria-label="Choose prescription type" className="grid gap-4 sm:grid-cols-2">
          <button type="button" onClick={() => setNewPrescriptionKind("medical")}
            className="rounded-2xl border border-blue-200 bg-white p-5 text-left shadow-sm transition hover:border-blue-400 hover:bg-blue-50">
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><Pill className="h-5 w-5" /></span>
            <span className="block font-bold text-slate-800">Medical prescription</span>
            <span className="mt-1 block text-sm text-slate-500">Record diagnosis, clinical notes, and medicine orders.</span>
          </button>
          <button type="button" onClick={() => setNewPrescriptionKind("dialysis")}
            className="rounded-2xl border border-violet-200 bg-white p-5 text-left shadow-sm transition hover:border-violet-400 hover:bg-violet-50">
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><FileText className="h-5 w-5" /></span>
            <span className="block font-bold text-slate-800">Dialysis prescription</span>
            <span className="mt-1 block text-sm text-slate-500">Record prescribed frequency, days, slot, and treatment parameters.</span>
          </button>
          <button type="button" onClick={() => setShowNew(false)} className="text-left text-sm font-semibold text-slate-500 hover:text-slate-800 sm:col-span-2">Cancel</button>
        </section>
      )}

      {showNew && newPrescriptionKind === "medical" && (
        <DoctorPrescriptionCreateForm patients={patients} prescriptions={prescriptions} audience={isAdmin ? "administrator" : "doctor"}
          onDraftStateChange={onDraftStateChange}
          onCancel={() => { setShowNew(false); setNewPrescriptionKind(null); }}
          onCreated={saved => {
            setPrescriptions(previous => [saved, ...previous.filter(prescription => prescription.id !== saved.id)]);
            setExpanded(saved.id); setSearch(""); setShowNew(false); setNewPrescriptionKind(null); setCreationSuccess(true);
          }}
          onViewExisting={prescription => {
            setShowNew(false); setNewPrescriptionKind(null); setSearch(prescription.patientUhid); setExpanded(prescription.id);
          }} />
      )}

      {showNew && newPrescriptionKind === "dialysis" && (
        <DialysisPrescriptionCreateForm patients={patients} prescriptions={prescriptions} audience={isAdmin ? "administrator" : "doctor"}
          onDraftStateChange={onDraftStateChange}
          onCancel={() => { setShowNew(false); setNewPrescriptionKind(null); }}
          onCreated={saved => {
            setPrescriptions(previous => [saved, ...previous.filter(prescription => prescription.id !== saved.id)]);
            setExpanded(saved.id); setSearch(""); setShowNew(false); setNewPrescriptionKind(null); setCreationSuccess(true);
          }}
          onViewExisting={prescription => {
            setShowNew(false); setNewPrescriptionKind(null); setSearch(prescription.patientUhid); setExpanded(prescription.id);
          }} />
      )}

      {/* Prescription cards */}
      {!showNew && <div className="space-y-4">
        {filtered.map(rx => {
          const isExpanded = expanded === rx.id;
          const isEditing  = editingId === rx.id;
          const draft      = isEditing ? editDraft! : null;
          const showHx     = showHistoryFor === rx.id;

          return (
            <div key={rx.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Card header */}
              <button
                className="w-full text-left p-5"
                onClick={() => { if (isEditing) return; setExpanded(isExpanded ? null : rx.id); }}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-blue-100 rounded-2xl flex items-center justify-center shrink-0">
                      <User className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="font-bold text-slate-800">{rx.patientName}</p>
                         <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                           {(() => {
                             const kinds = prescriptionKinds(rx);
                             return kinds.medical && kinds.dialysis ? "Medical + Dialysis" : kinds.medical ? "Medical" : "Dialysis";
                           })()}
                         </span>
                        <StatusBadge status={rx.status} />
                        {rx.history.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-semibold border border-slate-200">v{rx.history.length + 1}</span>
                        )}
                        {rx.updatedByRole === "Doctor" && (
                          <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-600 text-[10px] font-semibold border border-violet-200">Doctor edited</span>
                        )}
                      </div>
                        <p className="text-xs text-slate-500">{rx.patientUhid}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-slate-400 hidden md:block">{rx.id}</span>
                    {!isEditing && (isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />)}
                  </div>
                </div>
              </button>

              {(isExpanded || isEditing) && (
                <div className="border-t border-slate-100 px-5 pb-5">
                  {isEditing && draft ? (
                    /* ── EDIT MODE ── */
                    <fieldset disabled={savingRx} className="space-y-5 mt-4 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wider flex items-center gap-2">
                          <Edit2 className="w-3.5 h-3.5" /> Editing Prescription
                        </h3>
                      </div>

                      {conflict && <PrescriptionConflict key={draft.id} draft={draft} onResolve={reviewed => {
                        setEditDraft(reviewed); setConflict(false); setSaveError(null);
                      }} />}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Diagnosis
                          <input value={draft.diagnosis} onChange={event => setEditDraft({ ...draft, diagnosis: event.target.value })}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-700" />
                        </label>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Symptoms / clinical notes
                          <textarea rows={2} value={draft.symptoms ?? ""}
                            onChange={event => setEditDraft({ ...draft, symptoms: event.target.value })}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-700" />
                        </label>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Investigation findings
                          <textarea rows={2} value={draft.investigationFindings ?? ""}
                            onChange={event => setEditDraft({ ...draft, investigationFindings: event.target.value })}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-700" />
                        </label>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Doctor's advice
                          <textarea rows={2} value={draft.advice ?? ""}
                            onChange={event => setEditDraft({ ...draft, advice: event.target.value })}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-700" />
                        </label>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Dietary advice
                          <textarea rows={2} value={draft.dietaryAdvice ?? ""}
                            onChange={event => setEditDraft({ ...draft, dietaryAdvice: event.target.value })}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-700" />
                        </label>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Follow-up date
                          <input type="date" value={draft.followUpDate ?? ""}
                            onChange={event => setEditDraft({ ...draft, followUpDate: event.target.value })}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-700" />
                        </label>
                      </div>
                      {/* Dialysis Rx */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-blue-600" /> Dialysis Prescription
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                              Weekly Dialysis Sessions
                              <input aria-label="Weekly Dialysis Sessions" readOnly value={weeklySessionsCountFromDays(draft.dialysisRx.dialysisDays)}
                                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-normal text-slate-700" />
                            </label>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Dialysis Days</label>
                            <div className="flex flex-wrap gap-1.5 p-2 border border-slate-200 rounded-lg bg-white min-h-[40px]">
                              {DIALYSIS_DAY_OPTIONS.map(day => {
                                const sel = draft.dialysisRx.dialysisDays.includes(day);
                                return (
                                  <button key={day} type="button" aria-pressed={sel} onClick={() => toggleDay(day)}
                                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${sel ? "bg-blue-600 text-white border-blue-600" : "bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300"}`}>
                                    {day.slice(0, 3)}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Slot</label>
                            <select value={draft.dialysisRx.slot} onChange={e => updateRxScalar("slot", e.target.value)}
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">
                              {SLOT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Duration</label>
                            <select value={draft.dialysisRx.duration} onChange={e => updateRxScalar("duration", e.target.value)}
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">
                              {DURATION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </div>
                          {RX_SCALAR_FIELDS.filter(f => !["weeklySessionsCount","slot","duration"].includes(f.key)).map(({ key, label }) => (
                            <div key={key}>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</label>
                              <input
                                type="text"
                                value={draft.dialysisRx[key] as string}
                                onChange={e => updateRxScalar(key, e.target.value)}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Medications */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            <Pill className="w-3.5 h-3.5 text-violet-600" /> Medications
                          </h4>
                          <button onClick={addMedRow} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold">
                            <Plus className="w-3 h-3" /> Add row
                          </button>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead><tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                              <th className="text-left px-2 py-2 rounded-l-lg">Medication</th>
                              <th className="text-left px-2 py-2">Strength</th>
                              <th className="text-left px-2 py-2">Dose</th>
                              <th className="text-left px-2 py-2">Route</th>
                              <th className="text-left px-2 py-2">Frequency</th>
                              <th className="text-left px-2 py-2">Duration</th>
                              <th className="px-2 py-2 rounded-r-lg"></th>
                            </tr></thead>
                            <tbody>
                              {draft.medications.map((med, i) => (
                                <tr key={i}>
                                  <td className="px-1 py-1">
                                    <input value={med.name} onChange={e => updateMed(i, "name", e.target.value)} placeholder="Medication name"
                                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300" />
                                  </td>
                                  <td className="px-1 py-1">
                                    <input value={med.strength ?? ""} onChange={e => updateMed(i, "strength", e.target.value)} placeholder="Strength"
                                      className="w-full min-w-24 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300" />
                                  </td>
                                  <td className="px-1 py-1">
                                    <input value={med.dose} onChange={e => updateMed(i, "dose", e.target.value)} placeholder="Dose"
                                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300" />
                                  </td>
                                  <td className="px-1 py-1">
                                    <input value={med.route} onChange={e => updateMed(i, "route", e.target.value)} placeholder="Route"
                                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300" />
                                  </td>
                                  <td className="px-1 py-1">
                                    <input value={med.frequency} onChange={e => updateMed(i, "frequency", e.target.value)} placeholder="Frequency"
                                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300" />
                                  </td>
                                  <td className="px-1 py-1">
                                    <input value={med.duration ?? ""} onChange={e => updateMed(i, "duration", e.target.value)} placeholder="Duration"
                                      className="w-full min-w-24 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300" />
                                  </td>
                                  <td className="px-1 py-1">
                                    <button onClick={() => removeMedRow(i)} className="flex justify-center text-red-400 hover:text-red-600 p-1.5">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Notes */}
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Clinical Notes
                        </label>
                        <textarea
                          rows={3}
                          aria-label="Clinical Notes"
                          value={draft.notes}
                          onChange={e => setEditDraft({ ...draft, notes: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                        />
                      </div>
                      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                        {saveError && <p role="alert" className="mr-auto self-center text-sm text-red-700">{saveError}</p>}
                        <button type="button" disabled={savingRx} onClick={cancelEdit}
                          className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                          Cancel
                        </button>
                        <button type="button" disabled={savingRx || conflict} onClick={saveEdit}
                          className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60">
                          {savingRx ? "Saving…" : "Save Changes"}
                        </button>
                      </div>
                    </fieldset>
                  ) : (
                    /* ── VIEW MODE ── */
                    <div>
                      {(RX_SCALAR_FIELDS.some(({ key }) => rx.dialysisRx[key]) || rx.dialysisRx.dialysisDays.length > 0) && <div className="mt-4 mb-5">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-blue-600" /> Dialysis Prescription
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {RX_SCALAR_FIELDS.map(({ key, label }) => (
                            <div key={key} className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                                {key === "weeklySessionsCount" ? "Weekly Dialysis Sessions" : label}
                              </p>
                              <p className="text-sm font-semibold text-slate-700">
                                {key === "weeklySessionsCount"
                                  ? weeklySessionsCountFromDays(rx.dialysisRx.dialysisDays)
                                  : rx.dialysisRx[key] as string}
                              </p>
                            </div>
                          ))}
                          <div className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100 md:col-span-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Dialysis Days</p>
                            <div className="flex flex-wrap gap-1.5">
                              {rx.dialysisRx.dialysisDays.map(d => (
                                <span key={d} className="px-2 py-0.5 bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold rounded-full">{d}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>}

                      <div className="mb-5">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <Pill className="w-3.5 h-3.5 text-violet-600" /> Medications ({rx.medications.length})
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                                <th className="text-left px-3 py-2 rounded-l-lg">Medication</th>
                                <th className="text-left px-3 py-2">Dose</th>
                                <th className="text-left px-3 py-2">Frequency</th>
                                <th className="text-left px-3 py-2 rounded-r-lg">Route</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rx.medications.map((med, i) => {
                                const medication = med as Partial<PrescriptionMedicationDetails> & RxMedication;
                                return (
                                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                                  <td className="px-3 py-2.5 font-semibold text-slate-800">
                                    {med.name}
                                    {medication.strength && <span className="block text-xs font-normal text-slate-500">Strength: {medication.strength}</span>}
                                    {medication.duration && <span className="block text-xs font-normal text-slate-500">Duration: {medication.duration}</span>}
                                  </td>
                                  <td className="px-3 py-2.5 text-slate-600">{med.dose}</td>
                                  <td className="px-3 py-2.5 text-slate-600">{med.frequency}</td>
                                  <td className="px-3 py-2.5">
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                      med.route === "IV" ? "bg-red-100 text-red-700" :
                                      med.route === "SC" ? "bg-orange-100 text-orange-700" :
                                      "bg-slate-100 text-slate-600"
                                    }`}>{med.route}</span>
                                  </td>
                                </tr>
                              );})}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {rx.notes && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex gap-2 items-start mb-4">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-0.5">Clinical Notes</p>
                            <p className="text-sm text-amber-800">{rx.notes}</p>
                          </div>
                        </div>
                      )}

                      {rx.history.length > 0 && (
                        <div className="mb-4">
                          <button
                            onClick={() => setShowHistoryFor(showHx ? null : rx.id)}
                            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 font-semibold mb-2"
                          >
                            <ScrollText className="w-3.5 h-3.5" />
                            {showHx ? "Hide" : "Show"} Prescription History ({rx.history.length} {rx.history.length === 1 ? "version" : "versions"})
                            {showHx ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                          {showHx && (
                            <div className="space-y-3 pl-2 border-l-2 border-slate-100">
                              {rx.history.map(h => (
                                <div key={h.version} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Version {h.version}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                      h.status === "Active" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                                      h.status === "Revised" ? "bg-amber-100 text-amber-700 border-amber-200" :
                                      "bg-red-100 text-red-700 border-red-200"
                                    }`}>{h.status}</span>
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-2">
                                    <div className="bg-white rounded-lg px-2 py-1.5 border border-slate-100">
                                      <p className="text-[9px] font-bold text-slate-400 uppercase">Sessions/Week</p>
                                      <p className="text-xs font-semibold text-slate-600">{weeklySessionsCountFromDays(h.dialysisRx.dialysisDays)}</p>
                                    </div>
                                    <div className="bg-white rounded-lg px-2 py-1.5 border border-slate-100 col-span-2">
                                      <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Days</p>
                                      <div className="flex flex-wrap gap-1">
                                        {h.dialysisRx.dialysisDays.map(d => (
                                          <span key={d} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-bold rounded-full">{d.slice(0,3)}</span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                  <p className="text-xs text-slate-500 italic">{h.notes}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex gap-3 justify-end">
                        <button
                          onClick={() => startEdit(rx)}
                          className="flex items-center gap-2 px-4 py-2 border border-blue-200 text-blue-600 rounded-xl hover:bg-blue-50 text-sm font-semibold"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Edit Prescription
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-semibold">
                          <Check className="w-3.5 h-3.5" /> Mark Reviewed
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
            <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No prescriptions found</p>
            <p className="text-slate-400 text-sm mt-1">Try adjusting your search query.</p>
          </div>
        )}
      </div>}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active",       value: prescriptions.filter(r => r.status === "Active").length,       cls: "bg-emerald-50 text-emerald-700" },
          { label: "Revised",      value: prescriptions.filter(r => r.status === "Revised").length,      cls: "bg-amber-50 text-amber-700" },
          { label: "Discontinued", value: prescriptions.filter(r => r.status === "Discontinued").length, cls: "bg-red-50 text-red-700" },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl p-4 text-center ${s.cls}`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs font-semibold mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
