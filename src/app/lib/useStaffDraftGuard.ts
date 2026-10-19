import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

type DraftKind = "prescription" | "clinical note";
export type StaffDraftState = { dirty: boolean; saving: boolean; kind: DraftKind };
export type StaffDraftStateListener = (state: StaffDraftState) => void;

function confirmDiscard(state: StaffDraftState, fallbackMessage?: string): boolean {
  if (state.saving) {
    window.alert(`The ${state.kind} is still being saved. Please wait before leaving.`);
    return false;
  }
  if (state.dirty) {
    return window.confirm(`You have unsaved ${state.kind} changes. Discard these changes and continue? Nothing will be saved.`);
  }
  return fallbackMessage ? window.confirm(fallbackMessage) : true;
}

// Staff portals own the guard; the Patient Portal never installs it.
export function useStaffLeaveGuard() {
  const state = useRef<StaffDraftState>({ dirty: false, saving: false, kind: "prescription" });
  const onDraftStateChange = useCallback<StaffDraftStateListener>(next => { state.current = next; }, []);
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

export function useStaffDraftGuard(
  snapshot: string | null,
  saving: boolean,
  onStateChange: StaffDraftStateListener,
  kind: DraftKind,
  pendingReviewChanges = false,
) {
  // Only opening an editor or explicit conflict review may change the baseline.
  const baseline = useRef<string | null>(null);
  const dirty = snapshot !== null && (pendingReviewChanges || snapshot !== baseline.current);
  useLayoutEffect(() => {
    onStateChange({ dirty, saving, kind });
    return () => onStateChange({ dirty: false, saving: false, kind });
  }, [dirty, saving, kind, onStateChange]);
  return {
    beginDraft: (nextSnapshot: string) => { baseline.current = nextSnapshot; },
    confirmDiscard: () => confirmDiscard({ dirty, saving, kind }),
  };
}
