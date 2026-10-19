import React, { useState } from "react";
import type { AdminPrescription } from "../AdminApp";
import { fetchPrescriptions } from "../lib/staffApi";

const fields = [
  ["diagnosis", "Diagnosis"], ["dialysisRx", "Dialysis prescription"],
  ["medications", "Medications"], ["notes", "Notes"],
] as const;
type Field = typeof fields[number][0];

function display(value: unknown): string {
  if (typeof value === "string") return value || "(empty)";
  if (Array.isArray(value)) return value.length ? value.map(display).join("\n") : "(none)";
  if (value && typeof value === "object") {
    return Object.entries(value).map(([key, item]) => `${key}: ${display(item)}`).join("\n");
  }
  return String(value ?? "");
}

/** Comparing never changes the draft or its base; only an explicit review does. */
export function PrescriptionConflict({ draft, onResolve }: {
  draft: AdminPrescription;
  onResolve: (reviewed: AdminPrescription) => void;
}) {
  const [latest, setLatest] = useState<AdminPrescription | null>(null);
  const [keepDraft, setKeepDraft] = useState<Partial<Record<Field, boolean>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function compare() {
    setLoading(true); setError(null);
    try {
      const current = (await fetchPrescriptions()).find(rx => rx.id === draft.id);
      if (!current) throw new Error("Prescription was not found. Your draft is still available.");
      setLatest(current);
      setKeepDraft({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the newer version.");
    } finally { setLoading(false); }
  }

  return (
    <section aria-label="Prescription conflict" className="my-4 min-w-0 rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3">
      <p role="alert" className="text-sm font-semibold text-amber-900">
        Another staff member saved this prescription. Your unsaved draft is preserved.
      </p>
      <button type="button" disabled={loading} onClick={compare}
        className="px-3 py-2 rounded-lg border border-amber-400 text-sm font-semibold disabled:opacity-50">
        {loading ? "Loading newer version…" : latest ? "Refresh comparison" : "Compare newer version"}
      </button>
      {error && <p role="alert" className="text-sm text-red-700">{error} Try loading again.</p>}
      {latest && <>
        <p className="text-sm">Comparing your draft (based on v{draft.version}) with v{latest.version}, saved by {latest.updatedBy} ({latest.updatedByRole}).
          {" "}Newer values are selected by default. Choose any draft values you want to keep, then review them in the editor before saving.</p>
        <p className="text-sm">Current status: {latest.status}. Saving a reviewed edit will mark it Revised.</p>
        {fields.map(([key, label]) => (
          <div key={key} className="rounded-lg border border-amber-200 p-3">
            <p className="text-sm font-bold mb-2">{label}</p>
            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-xs min-w-0">
                <input type="radio" aria-label={`Keep my draft: ${label}`} name={`${draft.id}-${key}`} checked={Boolean(keepDraft[key])}
                  onChange={() => setKeepDraft(prev => ({ ...prev, [key]: true }))} /> Keep my draft: {label}
                <pre className="whitespace-pre-wrap break-words mt-2 font-sans">{display(draft[key])}</pre>
              </label>
              <label className="text-xs min-w-0">
                <input type="radio" aria-label={`Use newer value: ${label}`} name={`${draft.id}-${key}`} checked={!keepDraft[key]}
                  onChange={() => setKeepDraft(prev => ({ ...prev, [key]: false }))} /> Use newer value: {label}
                <pre className="whitespace-pre-wrap break-words mt-2 font-sans">{display(latest[key])}</pre>
              </label>
            </div>
          </div>
        ))}
        <button type="button" disabled={loading} onClick={() => {
          const reviewed = { ...latest };
          for (const [key] of fields) {
            if (keepDraft[key]) Object.assign(reviewed, { [key]: draft[key] });
          }
          onResolve(structuredClone(reviewed));
        }} className="px-3 py-2 rounded-lg bg-amber-900 text-white text-sm font-semibold disabled:opacity-50">
          Apply reviewed values to editor
        </button>
        <p className="text-xs">This does not save anything yet. If another revision is saved meanwhile, you will be asked to compare again.</p>
      </>}
    </section>
  );
}
