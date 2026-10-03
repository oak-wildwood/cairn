// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makePart } from "../testParts";
import type { FeelingGroup } from "../types";
import FeelingGroupsModal from "./FeelingGroupsModal.svelte";

/**
 * jsdom has no `showModal` at all, so there is no original for `vi.spyOn` to
 * wrap: it is assigned here and deleted after, as `backup.test.ts` does for
 * `URL.createObjectURL`. Setting `open` is the part of it this test needs —
 * the dialog's contents are hidden without it.
 */
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
});

afterEach(() => {
  cleanup();
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
});

function renderModal(groups: FeelingGroup[], onadd = vi.fn(() => "new")) {
  const handlers = {
    onadd,
    onrename: vi.fn(),
    onassign: vi.fn(),
    ondelete: vi.fn(),
    onclose: vi.fn(),
  };
  render(FeelingGroupsModal, {
    props: {
      groups,
      parts: [makePart({ id: "a", feelings: ["scared"] })],
      ...handlers,
    },
  });
  return handlers;
}

describe("FeelingGroupsModal", () => {
  it("says there are no groups when there are none", () => {
    renderModal([]);
    expect(screen.getByText("No groups yet.")).toBeTruthy();
  });

  it("shows each group's name and feelings", () => {
    renderModal([
      { id: "g1", name: "fear", feelings: ["scared", "afraid"] },
      { id: "g2", name: "sadness", feelings: [] },
    ]);
    const names = screen.getAllByLabelText<HTMLInputElement>("Group name");
    expect(names.map((input) => input.value)).toEqual(["fear", "sadness"]);
    expect(screen.queryByText("No groups yet.")).toBeNull();
    expect(screen.getByText("afraid")).toBeTruthy();
  });

  it("commits a rename on change, for that group's id", async () => {
    const { onrename } = renderModal([{ id: "g1", name: "fear", feelings: [] }]);
    const input = screen.getByLabelText<HTMLInputElement>("Group name");
    input.value = "terror";
    await fireEvent.change(input);
    expect(onrename).toHaveBeenCalledWith("g1", "terror");
  });

  it("deletes the group whose button was pressed", async () => {
    const { ondelete } = renderModal([
      { id: "g1", name: "fear", feelings: [] },
      { id: "g2", name: "", feelings: [] },
    ]);
    await fireEvent.click(screen.getByRole("button", { name: "Delete group fear" }));
    await fireEvent.click(
      screen.getByRole("button", { name: "Delete group without a name" }),
    );
    expect(ondelete.mock.calls).toEqual([["g1"], ["g2"]]);
  });

  it("adds a group and focuses its name field", async () => {
    // The real store re-renders with the new group; stand in for that by
    // returning the id of a group that is already on the list.
    const onadd = vi.fn(() => "g2");
    renderModal(
      [
        { id: "g1", name: "fear", feelings: [] },
        { id: "g2", name: "", feelings: [] },
      ],
      onadd,
    );
    await fireEvent.click(screen.getByRole("button", { name: "+ Add a group" }));
    await tick();
    expect(onadd).toHaveBeenCalledTimes(1);
    expect(document.activeElement?.id).toBe("feeling-group-name-g2");
  });
});
