// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import { makePart } from "../testParts";
import type { Part, PartRole } from "../types";
import PartNode from "./PartNode.svelte";

/**
 * Only the wiring is tested here — which status dashes is `layout.ts`'s
 * `nodeStrokeDashArray`, tested on its own. This checks the node's circle
 * actually asks it, and asks it about nothing but status.
 */
afterEach(() => cleanup());

const noop = (): void => {};

function nodeDash(part: Part): string | null {
  const { container } = render(PartNode, {
    props: {
      part,
      position: { x: 0, y: 0 },
      selected: false,
      onselect: noop,
      onmove: noop,
      onconnectstart: noop,
      ontoggleactive: noop,
      dropTarget: false,
      drawing: false,
    },
  });
  // The node's own circle is the one drawn at the node radius with the glow
  // or the dash — the first `circle` directly inside the node group.
  const circle = container.querySelector("g.node > circle");
  if (!circle) throw new Error("PartNode rendered no circle");
  const dash = circle.getAttribute("stroke-dasharray");
  cleanup();
  return dash;
}

const ROLES: readonly PartRole[] = ["manager", "firefighter", "exile", "unknown"];

describe("PartNode stroke dash", () => {
  it("dashes an emerging or unwitnessed part in every role, whatever the case", () => {
    for (const role of ROLES) {
      for (const status of ["emerging", "Emerging", "UNWITNESSED"]) {
        expect(nodeDash(makePart({ role, status }))).toBe("3 4");
      }
    }
  });

  it("leaves every other part solid, including an unknown one", () => {
    for (const role of ROLES) {
      for (const status of ["", "witnessed"]) {
        expect(nodeDash(makePart({ role, status, active: true }))).toBeNull();
      }
    }
  });
});
