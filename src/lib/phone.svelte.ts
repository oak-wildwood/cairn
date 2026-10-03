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

class PhoneState {
  matches = $state(false);

  constructor() {
    if (typeof matchMedia !== "function") return;
    const query = matchMedia(PHONE_QUERY);
    this.matches = query.matches;
    query.addEventListener("change", (event) => {
      this.matches = event.matches;
    });
  }
}

export const phone = new PhoneState();
