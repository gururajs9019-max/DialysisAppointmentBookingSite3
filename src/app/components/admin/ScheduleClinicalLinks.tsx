import { useEffect, useState } from "react";
import { fetchSchedulingOptions, type SchedulingOptions } from "../../lib/staffApi";

export type ScheduleLinks = { doctor: string; doctorId: string; prescriptionId: string };

export function ScheduleClinicalLinks({ patientId, value, onChange, hideTreatingDoctor = false }: {
  patientId?: string; value: Partial<ScheduleLinks>; onChange: (links: ScheduleLinks) => void;
  hideTreatingDoctor?: boolean;
}) {
  const [options, setOptions] = useState<SchedulingOptions>({ doctors: [], prescriptions: [] });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setOptions({ doctors: [], prescriptions: [] });
    fetchSchedulingOptions(patientId).then(data => {
      if (active) { setOptions(data); setLoading(false); }
    }).catch(error => { if (active) { setError(error.message); setLoading(false); } });
    return () => { active = false; };
  }, [patientId, retry]);
  const change = (patch: Partial<ScheduleLinks>) => onChange({
    doctor: value.doctor || "", doctorId: value.doctorId || "",
    prescriptionId: value.prescriptionId || "", ...patch,
  });
  const input = "w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white";
  return <div className="space-y-3">
    {!hideTreatingDoctor && (
      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
        Treating Doctor
        <select aria-label="Treating Doctor" className={`${input} mt-1.5`} disabled={loading || !!error}
          value={value.doctorId || ""} onChange={e => change({
            doctorId: e.target.value, doctor: options.doctors.find(d => d.id === e.target.value)?.name || "",
          })}>
          <option value="">Not assigned</option>
          {options.doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </label>
    )}
    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
      Dialysis Prescription
      <select aria-label="Dialysis Prescription" className={`${input} mt-1.5`}
        disabled={loading || !!error || !patientId} value={value.prescriptionId || ""}
        onChange={e => change({ prescriptionId: e.target.value })}>
        <option value="">Not assigned</option>
        {options.prescriptions.map(p => <option key={p.id} value={p.id}>
          {p.diagnosis || "Prescription"} · v{p.version}
        </option>)}
      </select>
    </label>
    {loading && <p className="text-xs text-slate-500">Loading clinical assignments…</p>}
    {error && <p role="alert" className="text-xs text-red-700">{error}{" "}
      <button type="button" onClick={() => setRetry(n => n + 1)} className="underline">Retry</button>
    </p>}
  </div>;
}
