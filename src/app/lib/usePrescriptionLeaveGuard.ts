import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { AdminPrescription } from "../AdminApp";

export type PrescriptionDraftState = { dirty: boolean; saving: boolean };
export type PrescriptionDraftStateListener = (state: PrescriptionDraftState) => void;

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

function confirmDiscard(state: PrescriptionDraftState, fallbackMessage?: string): boolean {
  if (state.saving) {
    window.alert("The prescription is still being saved. Please wait before leaving.");
    return false;
  }
  if (state.dirty) {
    return window.confirm("You have unsaved prescription changes. Discard these changes and continue? Nothing will be saved.");
  }
  return fallbackMessage ? window.confirm(fallbackMessage) : true;
}

// Owned by a staff portal, not by the shared app or Patient Portal.
export function usePrescriptionLeaveGuard() {
  const state = useRef<PrescriptionDraftState>({ dirty: false, saving: false });
  const onDraftStateChange = useCallback<PrescriptionDraftStateListener>(next => { state.current = next; }, []);
  const confirmLeave = useCallback((fallbackMessage?: string) => confirmDiscard(state.current, fallbackMessage), []);
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!state.current.dirty && !state.current.saving) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);
  return { onDraftStateChange, confirmLeave };
}

export function usePrescriptionDraftGuard(
  draft: AdminPrescription | null,
  saving: boolean,
  onStateChange: PrescriptionDraftStateListener,
) {
  // Capture the editor's starting values, never the background-refreshed list.
  const baseline = useRef<string | null>(null);
  const dirty = draft !== null && baseline.current !== fingerprint(draft);
  useLayoutEffect(() => {
    onStateChange({ dirty, saving });
    return () => onStateChange({ dirty: false, saving: false });
  }, [dirty, saving, onStateChange]);
  return {
    beginDraft: (next: AdminPrescription) => { baseline.current = fingerprint(next); },
    confirmDiscard: () => confirmDiscard({ dirty, saving }),
  };
}
