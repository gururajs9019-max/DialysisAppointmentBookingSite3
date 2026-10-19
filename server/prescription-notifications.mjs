import { createHash } from "node:crypto";

// Clinical responsibility must come from explicit database links, never names.
// Reuse the prescription transaction: notifications roll back with the save.
export async function notifyPrescription(client, actor, patient, prescription) {
  const recipients = (await client.query(`
    SELECT u.id FROM portal_users u
    WHERE u.status='Active' AND u.id<>$2 AND (
      u.role='admin' OR (u.role='doctor' AND (
        EXISTS (SELECT 1 FROM dialysis_sessions s
                WHERE s.patient_id=$1 AND s.doctor_id=u.id AND s.status<>'cancelled')
        OR EXISTS (SELECT 1 FROM prescriptions p
                   WHERE p.patient_id=$1 AND p.created_by=u.id)
        OR EXISTS (SELECT 1 FROM prescription_versions v JOIN prescriptions p ON p.id=v.prescription_id
                   WHERE p.patient_id=$1 AND v.changed_by=u.id)
      ))
    )`, [patient.id, actor.id])).rows;
  const message = prescription.version === 1 ? "Prescription created" : "Prescription revised";
  const detail = `${patient.data.name} (${patient.uhid}) · Prescription v${prescription.version} · ${actor.role === "doctor" ? "Doctor" : "Administrator"} ${actor.name}.`;
  for (const recipient of recipients) {
    const id = `rx_${createHash("sha256").update(JSON.stringify([
      prescription.id, prescription.version, recipient.id,
    ])).digest("hex")}`;
    await client.query(
      `INSERT INTO notifications(id,user_id,type,message,detail,patient_id,record_id)
       VALUES($1,$2,'info',$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING`,
      [id, recipient.id, message, detail, patient.id, prescription.id],
    );
  }
}
