const KEY = "offramp_popup_seen_v1";

/** Browser storage can be blocked; the pop-up then simply is not remembered. */
export function offrampPopupSeen(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function markOfframpPopupSeen(): void {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    // Nothing to do: the pop-up may show again on the next visit.
  }
}
