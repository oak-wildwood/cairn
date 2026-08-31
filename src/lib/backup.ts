import type { PersistedState } from "./types";

/**
 * Reading and writing the map as a file on disk.
 *
 * localStorage is the app's real store, but it is a fragile place to keep the
 * only copy of something personal: clearing site data, a private window, or a
 * different browser all lose it silently, and the README's promise that the
 * data never leaves the browser means there is no server-side copy to fall
 * back on. A file the user holds is the way out of that, and the way back in.
 *
 * The format is exactly the persisted blob — same `schemaVersion`, same
 * shape — so a backup and a localStorage value are interchangeable, and
 * `parseMap` can validate a file with the checks already written for storage.
 */

/** `2026-08-31` — sorts chronologically in a file listing. */
export function fileStamp(now: Date): string {
  const pad = (value: number): string => String(value).padStart(2, "0");
  return [now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate())].join(
    "-",
  );
}

/** `cairn-map-2026-08-31.json`. Shares its stem with the PNG export. */
export function backupFileName(now: Date): string {
  return `cairn-map-${fileStamp(now)}.json`;
}

/**
 * Hand the map to the browser as a download.
 *
 * The detached anchor is the only way to name a downloaded file from script,
 * and it is not the DOM-ownership violation the repo's D3 rule is about: this
 * element is never inserted into the document, never rendered, and nothing
 * reactive can observe it. Pretty-printed because the point of a backup is
 * that a person can open it, read it, and see their own words in it.
 */
export function downloadMap(state: PersistedState, now: Date = new Date()): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = backupFileName(now);
  link.click();
  // Revoking immediately is safe — the download has already been handed off,
  // and leaving it would pin the whole map in memory for the page's lifetime.
  URL.revokeObjectURL(url);
}
