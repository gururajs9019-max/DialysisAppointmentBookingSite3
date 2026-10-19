import { useState, useRef, useEffect } from "react";
import { FileText, Plus, Search, User, Edit, Trash2, X, ChevronDown, Check } from "lucide-react";
import type { Patient } from "../../AdminApp";
import { createClinicalNote, fetchClinicalNotes, fetchAllClinicalNotes, updateClinicalNote, ClinicalNoteConflictError } from "../../lib/staffApi";
import { ClinicalNoteConflict, type NoteDraft } from "./ClinicalNoteConflict";
import { useStaffDraftGuard, type StaffDraftStateListener } from "../../lib/useStaffDraftGuard";

interface ClinicalNotesProps {
  onNavigate: (view: string) => void;
  patients: Patient[];
  onDraftStateChange: StaffDraftStateListener;
}

interface NoteVitals {
  bloodPressure: string;
  heartRate: string;
  weight: string;
  temperature: string;
}

interface Note {
  id: string;
  version: number;
  patientName: string;
  patientId: string;
  patientUhid: string;
  date: string;
  noteType: string;
  title: string;
  content: string;
  vitals?: NoteVitals;
  author: string;
}

// ─── Searchable patient selector ─────────────────────────────────────────────

function PatientSearchSelect({
  value,
  onChange,
  error,
  patients,
}: {
  value: Patient | null;
  onChange: (p: Patient | null) => void;
  error?: boolean;
  patients: Patient[];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim().length === 0
    ? patients
    : patients.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) || p.uhid.toLowerCase().includes(query.toLowerCase())
      );

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function openDropdown() {
    setOpen(true);
    // If a patient is already selected, clear query so doctor can type a new search
    if (value) setQuery("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function select(p: Patient) {
    onChange(p);
    setQuery("");
    setOpen(false);
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
    setQuery("");
    setOpen(false);
  }

  const borderClass = error
    ? "border-red-400 ring-2 ring-red-200"
    : open
      ? "border-blue-500 ring-2 ring-blue-100"
      : "border-gray-300 hover:border-gray-400";

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex items-center w-full px-3 py-2 bg-white border rounded-lg cursor-text transition-all ${borderClass}`}
        onClick={openDropdown}
      >
        {open ? (
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type patient name…"
            className="flex-1 text-sm outline-none bg-transparent text-gray-800 placeholder-gray-400"
          />
        ) : value ? (
          <span className="flex-1 text-sm text-gray-800 font-medium flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            {value.name}
          </span>
        ) : (
          <span className="flex-1 text-sm text-gray-400">Select Patient</span>
        )}

        <div className="flex items-center gap-1 ml-2 shrink-0">
          {value && !open && (
            <button
              type="button"
              onClick={clear}
              className="p-0.5 rounded text-gray-400 hover:text-gray-600"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-400 text-center">No patients found</div>
          ) : (
            filtered.map(p => (
              <button
                key={p.id}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => select(p)}
                className={`w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0 ${
                  value?.id === p.id ? "bg-blue-50" : ""
                }`}
              >
                <p className="text-sm font-medium text-gray-800">{p.name}</p>
                <p className="text-xs text-gray-500">UHID: {p.uhid}</p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const emptyDraft: NoteDraft = { title: "", body: "", noteType: "session", bloodPressure: "", heartRate: "", weight: "", temperature: "" };
const noteSnapshot = (patientId: string | null, draft: NoteDraft) => JSON.stringify({ patientId,
  title: draft.title, body: draft.body, noteType: draft.noteType, bloodPressure: draft.bloodPressure,
  heartRate: draft.heartRate, weight: draft.weight, temperature: draft.temperature });

export function ClinicalNotes({ onNavigate: _onNavigate, patients, onDraftStateChange }: ClinicalNotesProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [baseVersion, setBaseVersion] = useState<number | null>(null);
  const [conflict, setConflict] = useState(false);
  const [reviewDirty, setReviewDirty] = useState(false);

  // Form state
  const [formPatient, setFormPatient] = useState<Patient | null>(null);
  const [formNoteType, setFormNoteType] = useState("session");
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formBP, setFormBP] = useState("");
  const [formHR, setFormHR] = useState("");
  const [formWeight, setFormWeight] = useState("");
  const [formTemp, setFormTemp] = useState("");
  const [patientError, setPatientError] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const currentDraft: NoteDraft = { body: formContent, title: formTitle, noteType: formNoteType,
    bloodPressure: formBP, heartRate: formHR, weight: formWeight, temperature: formTemp };
  const draftGuard = useStaffDraftGuard(
    showAddForm ? noteSnapshot(formPatient?.id || null, currentDraft) : null,
    saving, onDraftStateChange, "clinical note", reviewDirty,
  );

  const loadNotes = async (patient?: Patient) => {
    setNotesLoading(true); setNotesError(null);
    try {
      const result = patient ? await fetchClinicalNotes(patient.id) : await fetchAllClinicalNotes();
      setNotes(result.notes.map(note => {
        const owner = patient || patients.find(p=>p.id===note.patient_id);
        return {
          id: note.id, version: note.version, patientName: owner?.name || "Patient", patientId: note.patient_id, patientUhid: owner?.uhid || "",
          date: note.updated_at || note.created_at, noteType: note.data?.noteType || "general",
          title: note.data?.title || "Clinical Note", content: note.body, author: note.author_name || "Staff",
          vitals: note.data?.vitals as unknown as NoteVitals,
        };
      }));
    } catch (error) { setNotesError(error instanceof Error ? error.message : "Clinical notes could not be loaded."); }
    finally { setNotesLoading(false); }
  };

  useEffect(() => { void loadNotes(formPatient || undefined); }, [formPatient, patients]);

  const filteredNotes = notes.filter(note =>
    note.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function resetForm() {
    setEditingId(null);
    setBaseVersion(null); setConflict(false); setReviewDirty(false); setSaveError(null);
    setFormPatient(null);
    setFormNoteType("session");
    setFormTitle("");
    setFormContent("");
    setFormBP("");
    setFormHR("");
    setFormWeight("");
    setFormTemp("");
    setPatientError(false);
  }

  function handleCancelForm() {
    if (!draftGuard.confirmDiscard()) return;
    resetForm();
    setShowAddForm(false);
  }

  function handleNewNote() {
    if (!draftGuard.confirmDiscard()) return;
    draftGuard.beginDraft(noteSnapshot(null, emptyDraft));
    resetForm(); setShowAddForm(true);
  }

  async function handleSaveNote(e: React.FormEvent) {
    e.preventDefault();
    if (!formPatient) {
      setPatientError(true);
      return;
    }
    try {
      if (saving || conflict) return;
      setSaving(true);
      setSaveError(null);
      const data = { title: formTitle || "Clinical Note", noteType: formNoteType,
        vitals: { bloodPressure: formBP, heartRate: formHR, weight: formWeight, temperature: formTemp } };
      if (editingId) {
        if (baseVersion === null) throw new Error("Reopen the note before editing.");
        await updateClinicalNote(editingId, baseVersion, formContent, data);
      }
      else await createClinicalNote(formPatient.id, formContent, data);
      await loadNotes(formPatient);
      resetForm(); setShowAddForm(false);
    } catch (error) {
      if (error instanceof ClinicalNoteConflictError) setConflict(true);
      setSaveError(error instanceof Error ? error.message : "Clinical note could not be saved.");
    }
    finally { setSaving(false); }
  }

  const getNoteTypeColor = (type: string) => {
    switch (type) {
      case "session":      return "bg-blue-100 text-blue-700";
      case "complication": return "bg-red-100 text-red-700";
      case "assessment":   return "bg-green-100 text-green-700";
      default:             return "bg-gray-100 text-gray-700";
    }
  };

  const getNoteTypeLabel = (type: string) => {
    switch (type) {
      case "session":      return "Session Note";
      case "complication": return "Complication";
      case "assessment":   return "Assessment";
      default:             return "General";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Clinical Notes</h1>
            <p className="text-blue-100">Document and track patient treatment notes</p>
          </div>
          <button
            disabled={saving}
            onClick={handleNewNote}
            className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 font-medium"
          >
            <Plus className="w-5 h-5" />
            Add Note
          </button>
        </div>
      </div>

      {/* Add Note Form */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{editingId ? "Edit Clinical Note" : "New Clinical Note"}</h2>
          <form className="space-y-4" onSubmit={handleSaveNote}>
            <fieldset disabled={saving} className="space-y-4 min-w-0">
            {conflict && editingId && formPatient && <ClinicalNoteConflict key={editingId}
              id={editingId} patientId={formPatient.id}
              draft={currentDraft}
              onReviewChange={setReviewDirty}
              onResolve={(reviewed, version, saved) => {
                draftGuard.beginDraft(noteSnapshot(formPatient.id, saved));
                setReviewDirty(false);
                setFormContent(reviewed.body); setFormTitle(reviewed.title); setFormNoteType(reviewed.noteType);
                setFormBP(reviewed.bloodPressure); setFormHR(reviewed.heartRate);
                setFormWeight(reviewed.weight); setFormTemp(reviewed.temperature);
                setBaseVersion(version); setConflict(false); setSaveError(null);
              }} />}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Searchable patient selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Patient <span className="text-red-500">*</span>
                </label>
                {editingId ? <p className="px-3 py-2 text-sm text-gray-800">{formPatient?.name} ({formPatient?.uhid})</p> : <PatientSearchSelect
                  value={formPatient}
                  onChange={p => { setFormPatient(p); setPatientError(false); }}
                  error={patientError}
                  patients={patients}
                />}
                {patientError && (
                  <p className="mt-1 text-xs text-red-500">Please select a patient.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Note Type</label>
                <select
                  value={formNoteType}
                  onChange={e => setFormNoteType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="session">Session Note</option>
                  <option value="complication">Complication</option>
                  <option value="assessment">Assessment</option>
                  <option value="general">General</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
              <input
                type="text"
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Enter note title..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Clinical Notes</label>
              <textarea
                rows={6}
                value={formContent}
                onChange={e => setFormContent(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Enter detailed clinical observations, treatment notes, and patient status..."
              />
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h3 className="font-semibold text-gray-900 mb-3">Vital Signs (Optional)</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Blood Pressure</label>
                  <input
                    type="text"
                    value={formBP}
                    onChange={e => setFormBP(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="e.g., Normal"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Heart Rate</label>
                  <input
                    type="text"
                    value={formHR}
                    onChange={e => setFormHR(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="e.g., Normal"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Weight</label>
                  <input
                    type="text"
                    value={formWeight}
                    onChange={e => setFormWeight(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="e.g., Stable"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Temperature</label>
                  <input
                    type="text"
                    value={formTemp}
                    onChange={e => setFormTemp(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="e.g., Normal"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={saving || conflict}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Save Note
              </button>
              <button
                type="button"
                onClick={handleCancelForm}
                className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
            </div>
            {saveError && <p className="text-sm text-red-600">{saveError}</p>}
            </fieldset>
          </form>
        </div>
      )}

      {/* Search and Filter */}
      {notesLoading && <p className="text-sm text-blue-700">Loading saved notes…</p>}
      {notesError && <p className="text-sm text-red-600">{notesError}</p>}
      {!formPatient && !notesLoading && <p className="text-sm text-slate-500">Showing saved clinical notes for all patients.</p>}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search notes by patient, title, or content..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option>All Types</option>
              <option>Session Notes</option>
              <option>Complications</option>
              <option>Assessments</option>
              <option>General</option>
            </select>
            <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option>All Time</option>
              <option>Today</option>
              <option>This Week</option>
              <option>This Month</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notes List */}
      <div className="space-y-4">
        {filteredNotes.map(note => (
          <div
            key={note.id}
            className={`bg-white rounded-lg shadow-md p-6 cursor-pointer transition-all hover:shadow-lg ${
              selectedNote === note.id ? "ring-2 ring-blue-500" : ""
            }`}
            onClick={() => setSelectedNote(selectedNote === note.id ? null : note.id)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getNoteTypeColor(note.noteType)}`}>
                    {getNoteTypeLabel(note.noteType)}
                  </span>
                  <span className="text-sm text-gray-600">{note.date}</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">{note.title}</h3>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {note.patientName} ({note.patientUhid})
                  </span>
                  <span>By: {note.author}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={saving}
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                  title="Edit clinical note"
                  onClick={e => {
                    e.stopPropagation();
                    if (!draftGuard.confirmDiscard()) return;
                    draftGuard.beginDraft(noteSnapshot(note.patientId, {
                      body: note.content, title: note.title, noteType: note.noteType,
                      bloodPressure: note.vitals?.bloodPressure || "", heartRate: note.vitals?.heartRate || "",
                      weight: note.vitals?.weight || "", temperature: note.vitals?.temperature || "",
                    }));
                    setReviewDirty(false); setEditingId(note.id); setBaseVersion(note.version); setConflict(false);
                    setFormPatient(patients.find(p=>p.id===note.patientId)||null);
                    setFormTitle(note.title); setFormContent(note.content); setFormNoteType(note.noteType);
                    setFormBP(note.vitals?.bloodPressure||""); setFormHR(note.vitals?.heartRate||"");
                    setFormWeight(note.vitals?.weight||""); setFormTemp(note.vitals?.temperature||"");
                    setSaveError(null); setShowAddForm(true); window.scrollTo({top:0,behavior:"smooth"});
                  }}
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  disabled
                  title="Clinical-note deletion is not available in the saved records API."
                  className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  onClick={e => e.stopPropagation()}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {selectedNote === note.id && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-gray-700 mb-4">{note.content}</p>
                {note.vitals && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Vital Signs</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Blood Pressure</p>
                        <p className="font-medium text-gray-900">{note.vitals.bloodPressure}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Heart Rate</p>
                        <p className="font-medium text-gray-900">{note.vitals.heartRate}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Weight</p>
                        <p className="font-medium text-gray-900">{note.vitals.weight}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Temperature</p>
                        <p className="font-medium text-gray-900">{note.vitals.temperature}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredNotes.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No clinical notes found</p>
          <button
            onClick={handleNewNote}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Add First Note
          </button>
        </div>
      )}
    </div>
  );
}
