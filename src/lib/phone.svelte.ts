/**
 * Whether the app is on a phone-sized screen, as a reactive flag.
 *
 * The query is the same one every stylesheet in the app uses for its phone
 * layout (`App.svelte`, `Toolbar.svelte`, `Legend.svelte`, ...), so "phone" in
 * script and "phone" in CSS can't disagree about which screens are which.
 *
 * Module-level and never torn down: there is one window, and the listener
 * lives as long as the page does.
 */
export const PHONE_QUERY = "(max-width: 720px), (max-height: 560px)";

/**
 * A portrait phone, where the detail panel is a bottom sheet under the map
 * that can be pulled up to fill the screen. A landscape phone puts the panel
 * back beside the map instead (see `PartDetailPanel.svelte`), so it has no
 * sheet to expand.
 */
export const SHEET_QUERY = "(max-width: 720px) and (orientation: portrait)";

class MediaFlag {
  matches = $state(false);

  constructor(source: string) {
    if (typeof matchMedia !== "function") return;
    const query = matchMedia(source);
    this.matches = query.matches;
    query.addEventListener("change", (event) => {
      this.matches = event.matches;
    });
  }
}

export const phone = new MediaFlag(PHONE_QUERY);

export const sheet = new MediaFlag(SHEET_QUERY);

export const reducedMotion = new MediaFlag("(prefers-reduced-motion: reduce)");
