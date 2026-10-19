// Shared by the staff analytics API and existing staff reporting components.
export const investigationPaths = {
  CBC: ["cbc.hb", "cbc.hemoglobin", "cbc.tlc", "cbc.plt", "cbc.mcv"],
  "Serum Ferritin": ["serumFerritin"], "Serum Calcium": ["serumCalcium"],
  "Thyroid Profile": ["thyroidProfile.t3", "thyroidProfile.t4", "thyroidProfile.tsh"],
  "2D Echo": ["twoDEcho"], EF: ["ejectionFraction", "ef"],
  "Serum Phosphorous": ["serumPhosphorous"],
  "Renal Function Test": ["rft.urea", "rft.creatinine", "rft.serumCreatinine"],
  LFT: ["lft.totalProtein", "lft.albumin", "lft.totalBilirubin", "lft.directBilirubin", "lft.ast", "lft.alt", "lft.alp"],
};
export function recorded(value) {
  if (value === null || value === undefined || value === "") return false;
  if (typeof value === "object") return Object.values(value).some(recorded);
  return String(value).trim() !== "";
}
export function clinicalValue(patient, path) {
  return path.split(".").reduce((value, key) => value?.[key], patient.investigations || {})
    ?? path.split(".").reduce((value, key) => value?.[key], patient.medicalInfo || {});
}
export function investigationStats(patients, label) {
  const paths = investigationPaths[label] || Object.values(investigationPaths).flat();
  const count = patients.filter(p => paths.some(path => recorded(clinicalValue(p, path)))).length;
  const numeric = patients.flatMap(p => paths.slice(0, 1).map(path => clinicalValue(p, path)))
    .filter(v => recorded(v) && Number.isFinite(Number(v))).map(Number);
  return { recorded: count, missing: patients.length - count, total: patients.length,
    percentage: patients.length ? Math.round(count / patients.length * 100) : 0,
    average: numeric.length ? numeric.reduce((a, b) => a + b, 0) / numeric.length : null,
    minimum: numeric.length ? Math.min(...numeric) : null, maximum: numeric.length ? Math.max(...numeric) : null };
}
