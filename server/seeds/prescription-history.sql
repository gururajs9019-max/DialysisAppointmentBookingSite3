-- Only an unchanged initial demo prescription can supply its v1 snapshot.
-- Never invent an earlier version from a subsequently edited prescription.
INSERT INTO prescription_versions(id,prescription_id,version,snapshot,changed_by,created_at)
SELECT 'DEMO-RX001-V1',id,1,data,created_by,created_at FROM prescriptions
WHERE id='DEMO-RX001' AND version=1
ON CONFLICT(prescription_id,version) DO NOTHING;
