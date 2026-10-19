// Historical sessions can remain unassigned. New explicit assignments must
// reference an active doctor and a prescription belonging to this patient.
export async function validateSessionLinks(client, input, patientId, { text, httpError }) {
  let doctorId = text(input.doctorId, "doctorId", { max: 100 }) || null;
  const name = text(input.doctor, "doctor") || "";
  let doctor = "Not assigned";
  if (doctorId || (name && name !== "Not assigned")) {
    const result = await client.query(
      `SELECT id,name FROM portal_users WHERE role='doctor' AND status='Active'
       AND ${doctorId ? "id=$1" : "name=$1"} FOR SHARE`, [doctorId || name]);
    if (result.rows.length !== 1) throw httpError(400, "Choose an active doctor from the staff directory.");
    doctorId = result.rows[0].id;
    doctor = result.rows[0].name;
  }
  const prescriptionId = text(input.prescriptionId, "prescriptionId", { max: 100 }) || null;
  if (prescriptionId) {
    const result = await client.query(
      "SELECT id FROM prescriptions WHERE id=$1 AND patient_id=$2 AND status<>'Discontinued' FOR SHARE",
      [prescriptionId, patientId]);
    if (!result.rowCount) throw httpError(400, "Choose a current prescription belonging to this patient.");
  }
  return { doctorId, prescriptionId, doctor };
}
