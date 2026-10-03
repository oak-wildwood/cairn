// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makePart } from "../testParts";
import type { Part } from "../types";
import PartDetailPanel from "./PartDetailPanel.svelte";

afterEach(() => cleanup());

const noop = (): void => {};

function renderPanel(part: Part, ontoggleactive = vi.fn()) {
  // `intro: false` skips the reveal transition, which needs Web Animations.
  const { container, getByRole } = render(PartDetailPanel, {
    intro: false,
    props: {
      part,
      connections: [],
      parts: [part],
      onclose: noop,
      onedit: noop,
      ondelete: noop,
      onfeelings: noop,
      ontoggleactive,
      brand: createRawSnippet(() => ({ render: () => "<span>Cairn</span>" })),
    },
  });
  return {
    container,
    toggle: getByRole("button", { name: "Active this week" }),
    ontoggleactive,
  };
}

describe("PartDetailPanel's active toggle", () => {
  it("reads as pressed for an active part", () => {
    const { toggle } = renderPanel(makePart({ name: "The Analyst", active: true }));
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
  });

  it("reads as not pressed for an inactive part", () => {
    const { toggle } = renderPanel(makePart({ name: "The Analyst", active: false }));
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
  });

  it("toggles the part it shows in one press", async () => {
    const { toggle, ontoggleactive } = renderPanel(
      makePart({ id: "analyst", name: "The Analyst" }),
    );
    await fireEvent.click(toggle);
    expect(ontoggleactive).toHaveBeenCalledExactlyOnceWith("analyst");
  });

  it("leaves 'active' out of the caption, which the pill already says", () => {
    const { container } = renderPanel(
      makePart({ name: "The Analyst", status: "emerging", active: true }),
    );
    expect(container.querySelector(".meta")?.textContent?.trim()).toBe(
      "MANAGER · EMERGING",
    );
  });
});
