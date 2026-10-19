import { useState } from "react";
import { fetchClinicalNotes, type ClinicalNoteDto } from "../../lib/staffApi";

export type NoteDraft = { body: string; title: string; noteType: string; bloodPressure: string; heartRate: string; weight: string; temperature: string };
const fields: Array<{ key: keyof NoteDraft; label: string }> = [
  { key: "title", label: "Title" }, { key: "noteType", label: "Note type" },
  { key: "body", label: "Clinical notes" }, { key: "bloodPressure", label: "Blood pressure" },
  { key: "heartRate", label: "Heart rate" }, { key: "weight", label: "Weight" }, { key: "temperature", label: "Temperature" },
];
function asDraft(note: ClinicalNoteDto): NoteDraft {
  return {
    body: note.body, title: note.data?.title || "Clinical Note", noteType: note.data?.noteType || "general",
    bloodPressure: note.data?.vitals?.bloodPressure || "", heartRate: note.data?.vitals?.heartRate || "",
    weight: note.data?.vitals?.weight || "", temperature: note.data?.vitals?.temperature || "",
  };
}

export function ClinicalNoteConflict({ id, patientId, draft, onResolve }: {
  id: string; patientId: string; draft: NoteDraft;
  onResolve: (draft: NoteDraft, version: number) => void;
}) {
  const [latest, setLatest] = useState<ClinicalNoteDto | null>(null);
  const [choices, setChoices] = useState<Partial<Record<keyof NoteDraft, "draft" | "latest">>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function compare() {
    setLoading(true); setError(null);
    try {
      const result = await fetchClinicalNotes(patientId);
      const note = result.notes.find(row => row.id === id);
      if (!note || !Number.isSafeInteger(note.version)) throw new Error("The newer note could not be loaded.");
      setLatest(note); setChoices({});
    } catch (error) { setError(error instanceof Error ? error.message : "Comparison failed. Try again."); }
    finally { setLoading(false); }
  }
  const newer = latest ? asDraft(latest) : null;
  return (
    <section aria-label="Clinical note conflict" className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-3">
      <h3 className="font-semibold text-amber-950">A newer clinical note was saved</h3>
      <p className="text-sm text-amber-900">Your draft is unchanged and has not been saved. Compare the newer note, choose the values to keep, then save explicitly.</p>
      <button type="button" disabled={loading} onClick={compare} className="rounded-lg border border-amber-400 bg-white px-3 py-2 text-sm font-medium disabled:opacity-50">
        {loading ? "Loading comparison…" : "Compare newer note"}
      </button>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {latest && newer && <>
        <p className="text-xs text-slate-600">Saved version {latest.version} · Original author: {latest.author_name || "Staff"} · Updated: {new Date(latest.updated_at || latest.created_at).toLocaleString()}</p>
        <div className="space-y-3">
          {fields.map(({ key, label }) => (
            <fieldset key={key} className="min-w-0 rounded-lg border border-amber-200 bg-white p-3">
              <legend className="text-sm font-semibold px-1">{label}</legend>
              <div className="grid gap-3 md:grid-cols-2">
                {(["latest", "draft"] as const).map(source => (
                  <label key={source} className="block min-w-0 text-sm">
                    <span className="flex gap-2 items-center">
                      <input type="radio" aria-label={source === "latest" ? `Use newer: ${label}` : `Keep my draft: ${label}`}
                        name={`note-conflict-${id}-${key}`} checked={(choices[key] || "latest") === source}
                        onChange={() => setChoices(prev => ({ ...prev, [key]: source }))} />
                      {source === "latest" ? `Use newer: ${label}` : `Keep my draft: ${label}`}
                    </span>
                    <span className="block whitespace-pre-wrap break-words mt-1 text-slate-700">{(source === "latest" ? newer : draft)[key] || "Not recorded"}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <button type="button" onClick={() => {
          const reviewed = { ...newer };
          for (const { key } of fields) if (choices[key] === "draft") reviewed[key] = draft[key];
          onResolve(reviewed, latest.version);
        }} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white">
          Apply reviewed values to editor
        </button>
        <p className="text-xs text-slate-600">Applying values does not save. If someone edits again, saving will require another review.</p>
      </>}
    </section>
  );
}
