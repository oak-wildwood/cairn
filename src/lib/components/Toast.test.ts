// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import Toast from "./Toast.svelte";

afterEach(cleanup);

describe("Toast", () => {
  it("announces a failure as an alert and a success as a status", () => {
    const { unmount } = render(Toast, { tone: "bad", text: "Nope", ondismiss: vi.fn() });
    expect(screen.getByRole("alert").textContent).toContain("Nope");
    expect(screen.queryByRole("status")).toBeNull();
    unmount();
    render(Toast, { tone: "ok", text: "Done", ondismiss: vi.fn() });
    expect(screen.getByRole("status").textContent).toContain("Done");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("calls ondismiss when the close button is pressed", async () => {
    const ondismiss = vi.fn();
    render(Toast, { tone: "ok", text: "Done", ondismiss });
    await fireEvent.click(screen.getByRole("button", { name: "Dismiss message" }));
    expect(ondismiss).toHaveBeenCalledTimes(1);
  });
});
