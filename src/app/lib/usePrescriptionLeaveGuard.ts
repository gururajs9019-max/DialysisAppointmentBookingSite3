import type { AdminPrescription } from "../AdminApp";
import { useStaffDraftGuard, type StaffDraftState, type StaffDraftStateListener } from "./useStaffDraftGuard";

export type PrescriptionDraftState = StaffDraftState;
export type PrescriptionDraftStateListener = StaffDraftStateListener;
export { useStaffLeaveGuard as usePrescriptionLeaveGuard } from "./useStaffDraftGuard";

function fingerprint(draft: AdminPrescription): string {
  const rx = draft.dialysisRx;
  return JSON.stringify({
    diagnosis: draft.diagnosis, notes: draft.notes, status: draft.status,
    dialysisRx: {
      weeklySessionsCount: rx.weeklySessionsCount,
      dialysisDays: [...rx.dialysisDays].sort(), slot: rx.slot, duration: rx.duration,
      bloodFlow: rx.bloodFlow, dialysateFlow: rx.dialysateFlow, membrane: rx.membrane,
      dryWeight: rx.dryWeight, anticoagulation: rx.anticoagulation,
    },
    medications: draft.medications.map(({ name, dose, frequency, route }) => ({ name, dose, frequency, route })),
  });
}

export function usePrescriptionDraftGuard(
  draft: AdminPrescription | null,
  saving: boolean,
  onStateChange: PrescriptionDraftStateListener,
) {
  const guard = useStaffDraftGuard(draft ? fingerprint(draft) : null, saving, onStateChange, "prescription");
  return {
    beginDraft: (next: AdminPrescription) => guard.beginDraft(fingerprint(next)),
    confirmDiscard: guard.confirmDiscard,
  };
}
