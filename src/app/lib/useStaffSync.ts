import { useEffect } from "react";
import { loadStaffData, type StaffData } from "./staffApi";

// Staff portals only: refresh shared records without replacing in-progress form drafts.
export function useStaffSync(enabled: boolean, apply: (data: StaffData) => void, onError: (error: string | null) => void) {
  useEffect(() => {
    if (!enabled) return;
    let disposed = false, pending = false, refreshAgain = false;
    const refresh = async () => {
      if (disposed || document.visibilityState === "hidden") return;
      if (pending) { refreshAgain = true; return; }
      pending = true;
      try {
        const data = await loadStaffData();
        if (!disposed) { apply(data); onError(null); }
      } catch (e) {
        if (!disposed) onError(e instanceof Error ? e.message : "Staff records could not be refreshed.");
      } finally {
        pending = false;
        if (refreshAgain && !disposed) {
          refreshAgain = false;
          void refresh();
        }
      }
    };
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    window.addEventListener("staff-data-changed", refresh);
    return () => {
      disposed = true; clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("staff-data-changed", refresh);
    };
  }, [enabled, apply, onError]);
}
