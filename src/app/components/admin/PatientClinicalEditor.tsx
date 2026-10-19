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
    ["comorbidities","Comorbidities"],["medicalInfo.hypertension","Hypertension"],["medicalInfo.diabetes","Diabetes"],
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
function getValue(patient: Patient, path: string): string {
  const value=path.split(".").reduce<any>((obj,key)=>obj?.[key],patient);
  return value === null || value === undefined ? "" : String(value);
}
function putValue(object: Record<string,any>, path: string, value: string) {
  const parts=path.split(".");let current=object;
  parts.slice(0,-1).forEach(key=>{current[key] ||= {};current=current[key];});
  current[parts.at(-1)!]=value;
}

export function PatientClinicalEditor({ patient, onSaved, onClose }: {
  patient: Patient; onSaved: (patient: Patient)=>void; onClose: ()=>void;
}) {
  const [draft,setDraft]=useState(()=>Object.fromEntries(fields.map(([path])=>[path,getValue(patient,path)])));
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const save=async(event:React.FormEvent)=>{
    event.preventDefault();if(saving)return;
    const changes: Record<string,any>={};
    fields.forEach(([path])=>{if(draft[path]!==getValue(patient,path))putValue(changes,path,draft[path]);});
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {group.fields.map(([path,label])=><label key={path} className="text-xs text-slate-600 font-semibold">{label}
              <input type={path==="dateOfBirth"?"date":"text"} required={path==="name"} value={draft[path]}
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
