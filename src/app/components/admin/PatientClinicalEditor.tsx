import { useState } from "react";
import { X } from "lucide-react";
import type { Patient } from "../../AdminApp";
import { updatePatient } from "../../lib/staffApi";

const groups: { title: string; fields: [string,string][] }[] = [
  { title: "Patient Information", fields: [
    ["name","Patient Name"],["dateOfBirth","Date of Birth"],["mobile","Mobile Number"],["bloodGroup","Blood Group"],
    ["address","Address"],["city","City"],["primaryDisease","Native Kidney Disease"],["causeOfFailure","Cause of Kidney Failure"],
    ["treatingNephrologist","Treating Nephrologist"],["insurance","Insurance"],["remarks","Remarks"],
  ] },
  { title: "Medical Information", fields: [
    ["medicalInfo.dryWeight","Dry Weight (kg)"],["medicalInfo.weightGain","Weight Gain (kg)"],
    ["medicalInfo.avFistula","AV Fistula"],["medicalInfo.permacath","Permacath (Tunnelled)"],
    ["medicalInfo.temporaryCatheter","Temporary Catheter"],["medicalInfo.opdIpd","OPD / IPD"],
  ] },
  { title: "Clinical Investigations", fields: [
    ["investigations.cbc.hb","CBC — Hb"],["investigations.cbc.tlc","CBC — TLC"],["investigations.cbc.plt","CBC — PLT"],["investigations.cbc.mcv","CBC — MCV"],
    ["investigations.serumFerritin","Serum Ferritin"],["investigations.serumCalcium","Serum Calcium"],
    ["investigations.thyroidProfile.t3","Thyroid — T3"],["investigations.thyroidProfile.t4","Thyroid — T4"],["investigations.thyroidProfile.tsh","Thyroid — TSH"],
    ["investigations.twoDEcho","2D Echo"],["investigations.ejectionFraction","EF (%)"],["investigations.serumPhosphorous","Serum Phosphorous"],
    ["investigations.rft.urea","RFT — Urea"],["investigations.rft.creatinine","RFT — Creatinine"],
    ["investigations.lft.totalProtein","LFT — Total Protein"],["investigations.lft.albumin","LFT — Albumin"],
    ["investigations.lft.totalBilirubin","LFT — Total Bilirubin"],["investigations.lft.directBilirubin","LFT — Direct Bilirubin"],
    ["investigations.lft.ast","LFT — AST"],["investigations.lft.alt","LFT — ALT"],["investigations.lft.alp","LFT — ALP"],
  ] },
];
const fields = groups.flatMap(g=>g.fields);
const comorbidityOptions = [["hypertension","Hypertension"],["diabetes","Diabetes"],["others","Others"]] as const;
const weightFields = new Set(["medicalInfo.dryWeight","medicalInfo.weightGain"]);
type ComorbidityFlags = Record<typeof comorbidityOptions[number][0],boolean>;
function existingComorbidityFlags(patient: Patient): ComorbidityFlags {
  const medical = patient.medicalInfo || {};
  const saved = medical.comorbidityFlags as Partial<ComorbidityFlags> | undefined;
  const conditions = (patient.comorbidities || "").split(",").map(value=>value.trim()).filter(Boolean);
  const recorded = (value: unknown): boolean => {
    if (value && typeof value === "object") return Object.values(value).some(recorded);
    return value !== null && value !== undefined && !["","no","none","false","0"].includes(String(value).trim().toLowerCase());
  };
  return Object.fromEntries(comorbidityOptions.map(([key])=>[key,
    typeof saved?.[key] === "boolean" ? saved[key] :
      key === "others"
        ? conditions.some(value=>!(/hypertension|diabetes/i).test(value) && !["none","no"].includes(value.toLowerCase())) || recorded(medical.otherComorbidities)
        : conditions.some(value=>value.toLowerCase().includes(key)) || recorded(medical[key]),
  ])) as ComorbidityFlags;
}
function displayOtherComorbidityValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(displayOtherComorbidityValue).filter(Boolean).join(", ");
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => {
        const detail = displayOtherComorbidityValue(item);
        return detail ? `${key}: ${detail}` : "";
      })
      .filter(Boolean)
      .join(", ");
  }
  return value === null || value === undefined ? "" : String(value);
}
function existingOtherComorbidityDetails(patient: Patient): string {
  const saved = displayOtherComorbidityValue(patient.medicalInfo?.otherComorbidities);
  if (saved) return saved;
  return (patient.comorbidities || "").split(",").map(value => value.trim()).filter(value =>
    value && !/hypertension|diabetes/i.test(value) && !["others", "none", "no"].includes(value.toLowerCase())
  ).join(", ");
}
function getValue(patient: Patient, path: string): string {
  const value=path.split(".").reduce<any>((obj,key)=>obj?.[key],patient);
  return value === null || value === undefined ? "" : String(value);
}
function putValue(object: Record<string,any>, path: string, value: string | number) {
  const parts=path.split(".");let current=object;
  parts.slice(0,-1).forEach(key=>{current[key] ||= {};current=current[key];});
  current[parts.at(-1)!]=value;
}

export function PatientClinicalEditor({ patient, onSaved, onClose }: {
  patient: Patient; onSaved: (patient: Patient)=>void; onClose: ()=>void;
}) {
  const [draft,setDraft]=useState(()=>Object.fromEntries(fields.map(([path])=>[path,getValue(patient,path)])));
  const [comorbidityFlags,setComorbidityFlags]=useState(()=>existingComorbidityFlags(patient));
  const [otherComorbidities,setOtherComorbidities]=useState(()=>existingOtherComorbidityDetails(patient));
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const save=async(event:React.FormEvent)=>{
    event.preventDefault();if(saving)return;
    if(comorbidityFlags.others && !otherComorbidities.trim()) {
      setError("Please specify other comorbidities.");return;
    }
    const changes: Record<string,any>={};
    for (const [path,label] of fields) {
      if(weightFields.has(path) && draft[path]!==getValue(patient,path) && draft[path] !== "" &&
        (!Number.isFinite(Number(draft[path])) || Number(draft[path]) < 0 || (path==="medicalInfo.dryWeight" && Number(draft[path])===0))) {
        setError(`${label} must be ${path==="medicalInfo.dryWeight"?"greater than 0":"at least 0"}.`);return;
      }
      if(draft[path]!==getValue(patient,path))
        putValue(changes,path,weightFields.has(path) && draft[path]!=="" ? Number(draft[path]) : draft[path]);
    }
    const originalFlags=existingComorbidityFlags(patient);
    const originalOtherDetails=existingOtherComorbidityDetails(patient);
    const flagsChanged=comorbidityOptions.some(([key])=>comorbidityFlags[key]!==originalFlags[key]);
    const otherDetailsChanged=otherComorbidities.trim()!==originalOtherDetails.trim();
    const othersTurnedOff=originalFlags.others&&!comorbidityFlags.others;
    if(flagsChanged||otherDetailsChanged) {
      changes.medicalInfo ||= {};
      if(flagsChanged) {
        changes.medicalInfo.comorbidityFlags={
          ...((patient.medicalInfo?.comorbidityFlags as Partial<ComorbidityFlags>|undefined)||{}),
          ...comorbidityFlags,
        };
      }
      if(othersTurnedOff) changes.medicalInfo.otherComorbidities="";
      else if(otherDetailsChanged) changes.medicalInfo.otherComorbidities=otherComorbidities.trim();
      // Preserve named historical conditions and legacy readings; only the
      // three checkbox labels are replaced by the current selections.
      const oldDetails=originalOtherDetails.toLowerCase();
      const legacy=(patient.comorbidities || "").split(",").map(value=>value.trim()).filter(value=>{
        if(!value||comorbidityOptions.some(([,label])=>label.toLowerCase()===value.toLowerCase())) return false;
        const isCommonCondition=/hypertension|diabetes/i.test(value);
        if(othersTurnedOff) return isCommonCondition;
        if(otherDetailsChanged && !isCommonCondition && oldDetails.includes(value.toLowerCase())) return false;
        return true;
      });
      const selected=comorbidityOptions.filter(([key])=>comorbidityFlags[key] && !legacy.some(value=>
        key==="others" ? !(/hypertension|diabetes/i).test(value) : value.toLowerCase().includes(key)));
      changes.comorbidities=[...legacy,...selected.map(([,label])=>label)].join(", ");
    }
    if(!Object.keys(changes).length){onClose();return;}
    if(Object.keys(changes.medicalInfo||{}).some(key=>["avFistula","permacath","temporaryCatheter"].includes(key))) {
      changes.medicalInfo.dialysisAccess=[["avFistula","AVF"],["permacath","Permacath"],["temporaryCatheter","Temp Catheter"]]
        .filter(([key])=>draft[`medicalInfo.${key}`]&&!["no","none","false"].includes(draft[`medicalInfo.${key}`].toLowerCase()))
        .map(([,label])=>label).join(", ");
    }
    setSaving(true);setError(null);
    try{onSaved(await updatePatient(patient.id,changes));onClose();}
    catch(e){setError(e instanceof Error?e.message:"Clinical information could not be saved.");}
    finally{setSaving(false);}
  };
  return <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
    <section role="dialog" aria-modal="true" aria-labelledby="clinical-editor-title" className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
      <div className="px-6 py-4 border-b flex justify-between items-center">
        <div><h2 id="clinical-editor-title" className="font-bold text-slate-800">Edit Clinical Information</h2><p className="text-xs text-slate-500">{patient.name} · {patient.uhid}</p></div>
        <button onClick={onClose} disabled={saving} aria-label="Close clinical editor"><X className="w-5 h-5 text-slate-500" /></button>
      </div>
      <form onSubmit={save} className="overflow-y-auto p-6 space-y-6">
        {groups.map(group=><fieldset key={group.title}>
          <legend className="text-sm font-bold text-slate-700 mb-3">{group.title}</legend>
          {group.title==="Medical Information" && <div className="mb-4">
            <p className="text-xs text-slate-600 font-semibold mb-2">Comorbidities</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {comorbidityOptions.map(([key,label])=><label key={key} className="flex items-center gap-2 p-2.5 border border-slate-200 rounded-xl text-sm text-slate-700">
                <input type="checkbox" checked={comorbidityFlags[key]} onChange={event=>{
                  const checked=event.target.checked;
                  setComorbidityFlags(previous=>({...previous,[key]:checked}));
                  if(key==="others"&&!checked) setOtherComorbidities("");
                  setError(null);
                }}
                  className="h-4 w-4 accent-violet-600" />{label}
              </label>)}
            </div>
            {comorbidityFlags.others&&<label className="mt-3 block rounded-xl border border-violet-200 bg-violet-50/40 p-4 text-xs text-slate-600 font-semibold">
              Please specify other comorbidities *
              <input aria-label="Please specify other comorbidities" value={otherComorbidities} required
                onChange={event=>{setOtherComorbidities(event.target.value);setError(null);}}
                onInvalid={()=>setError("Please specify other comorbidities.")}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-violet-300" />
            </label>}
          </div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {group.fields.map(([path,label])=><label key={path} className="text-xs text-slate-600 font-semibold">{label}
              <input type={path==="dateOfBirth"?"date":weightFields.has(path)?"number":"text"}
                min={weightFields.has(path)?0:undefined} step={weightFields.has(path)?"any":undefined}
                inputMode={weightFields.has(path)?"decimal":undefined} required={path==="name"} value={draft[path]}
                onChange={e=>setDraft(prev=>({...prev,[path]:e.target.value}))}
                className="mt-1 w-full p-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300" />
            </label>)}
          </div>
        </fieldset>)}
        {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3"><button type="button" disabled={saving} onClick={onClose} className="border rounded-xl px-4 py-2 text-sm">Cancel</button>
          <button disabled={saving} className="bg-violet-600 text-white rounded-xl px-4 py-2 font-semibold text-sm disabled:opacity-50">{saving?"Saving…":"Save Clinical Information"}</button></div>
      </form>
    </section>
  </div>;
}
