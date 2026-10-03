// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/svelte";
import { flushSync } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FeelingsMultiSelect from "./FeelingsMultiSelect.svelte";

beforeEach(() => vi.useFakeTimers());

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** A trigger whose on-screen top can be moved, as scrolling would. */
function stubTriggerAt(position: { top: number }): void {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    if (!this.classList.contains("control")) return new DOMRect(0, 0, 0, 0);
    return new DOMRect(20, position.top, 200, 40);
  });
}

function renderOpen(): HTMLElement {
  const { container } = render(FeelingsMultiSelect, {
    props: {
      tagCounts: new Map([["sad", 1]]),
      selected: [],
      onChange: () => {},
      label: "Add feelings",
      eyebrow: "Feelings",
      autoOpen: true,
    },
  });
  return container;
}

function popoverTop(container: HTMLElement): string | undefined {
  return container.querySelector<HTMLElement>(".popover")?.style.top;
}

describe("FeelingsMultiSelect's popover", () => {
  it("stays put while nothing scrolls or animates", () => {
    const position = { top: 300 };
    stubTriggerAt(position);
    const container = renderOpen();
    position.top = 180;
    vi.advanceTimersByTime(100);
    flushSync();
    expect(popoverTop(container)).toBe("348px");
  });

  it("opens just under its trigger", () => {
    stubTriggerAt({ top: 300 });
    const container = renderOpen();
    expect(popoverTop(container)).toBe("348px");
  });

  it("moves with its trigger when the trigger scrolls", () => {
    const position = { top: 300 };
    stubTriggerAt(position);
    const container = renderOpen();
    position.top = 180;
    // `scroll` doesn't bubble; the popover hears it on the capture phase.
    container.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(20);
    flushSync();
    expect(popoverTop(container)).toBe("228px");
  });
});
