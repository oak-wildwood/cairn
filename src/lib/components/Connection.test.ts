// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import { SELF_ID } from "../types";
import type { EndpointRole } from "../types";
import ConnectionPath from "./Connection.svelte";

/**
 * Only the wiring is tested here — the geometry and the marker choice are
 * `layout.ts`'s `connectorCurve` and `connectorMarkerEnd`, tested on their
 * own. This checks the drawn path actually uses them.
 */
afterEach(() => cleanup());

const noop = (): void => {};

const endpoint = (id: string, x: number, y: number, role: EndpointRole) => ({
  id,
  point: { x, y },
  radius: 46,
  role,
});

function drawnPath(reciprocal: boolean, sourceId = "a"): SVGPathElement {
  const { container } = render(ConnectionPath, {
    props: {
      connection: { id: "c1", sourceId, targetId: "b", label: "protects" },
      source:
        sourceId === SELF_ID
          ? endpoint(SELF_ID, 0, 0, SELF_ID)
          : endpoint(sourceId, -200, -150, "manager"),
      target: endpoint("b", 220, -120, "exile"),
      selected: false,
      reciprocal,
      onselect: noop,
      onlabelchange: noop,
      ondelete: noop,
      onclose: noop,
    },
  });
  const path = container.querySelector<SVGPathElement>("path:not(.hit-area)");
  if (!path) throw new Error("Connection rendered no path");
  return path;
}

function renderSelected(editable: boolean): HTMLElement {
  const { container } = render(ConnectionPath, {
    props: {
      connection: { id: "c1", sourceId: "a", targetId: "b", label: "protects" },
      source: endpoint("a", -200, -150, "manager"),
      target: endpoint("b", 220, -120, "exile"),
      selected: true,
      reciprocal: false,
      editable,
      onselect: noop,
      onlabelchange: noop,
      ondelete: noop,
      onclose: noop,
    },
  });
  return container;
}

describe("Connection when selected", () => {
  it("opens the label editor with a delete button on a computer", () => {
    const container = renderSelected(true);
    expect(container.querySelector("input.label-input")).not.toBeNull();
    expect(container.querySelector("button.delete")).not.toBeNull();
  });

  it("shows the label as plain text, with nothing to edit, on a phone", () => {
    const container = renderSelected(false);
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector("text.label")?.textContent).toBe("protects");
  });
});

describe("Connection", () => {
  it("draws an arrowhead in its source's colour on half of a reciprocal pair", () => {
    expect(drawnPath(true).getAttribute("marker-end")).toBe("url(#arrow-manager)");
  });

  it("draws no arrowhead on a lone connector", () => {
    expect(drawnPath(false).hasAttribute("marker-end")).toBe(false);
  });

  it("draws a different arc for half of a reciprocal pair than for a lone connector", () => {
    const lone = drawnPath(false).getAttribute("d");
    cleanup();
    const reciprocal = drawnPath(true).getAttribute("d");
    expect(lone).toBeTruthy();
    expect(reciprocal).not.toBe(lone);
  });

  it("dots a connector between two parts but not one from Self", () => {
    expect(drawnPath(false).getAttribute("stroke-dasharray")).toBe("1 6");
    cleanup();
    expect(drawnPath(false, SELF_ID).hasAttribute("stroke-dasharray")).toBe(false);
  });
});
