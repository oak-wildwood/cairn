/**
 * The one-time "best on a computer" notice shown on a phone-sized screen, and
 * its "have they seen it" flag. Same shape as the tour's (see `tour.ts`).
 */
const SEEN_KEY = "cairn.mobile-notice.v1.seen";

/**
 * Defaults to "seen" when storage can't be read: a notice that can't remember
 * itself would greet someone on every visit, and not interrupting is the safer
 * failure.
 */
export function hasSeenMobileNotice(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

export function markMobileNoticeSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Best-effort — the notice offering itself again is harmless.
  }
}
