// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import Toolbar from "./Toolbar.svelte";

afterEach(() => cleanup());

const noop = (): void => {};

function renderToolbar(hideExport: boolean): HTMLElement {
  const { container } = render(Toolbar, {
    props: {
      onBackUp: noop,
      onRestore: noop,
      onStartFresh: noop,
      onStartTour: noop,
      hideExport,
    },
  });
  return container;
}

describe("Toolbar", () => {
  it("offers Save image and Export PDF on a computer", () => {
    const text = renderToolbar(false).textContent;
    expect(text).toContain("Save image");
    expect(text).toContain("Export PDF");
  });

  it("leaves both out on a phone, keeping Add a part", () => {
    const container = renderToolbar(true);
    expect(container.textContent).not.toContain("Save image");
    expect(container.textContent).not.toContain("Export PDF");
    expect(container.textContent).toContain("Add a part");
  });
});
