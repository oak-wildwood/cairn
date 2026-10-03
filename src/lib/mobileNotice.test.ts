// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hasSeenMobileNotice, markMobileNoticeSeen } from "./mobileNotice";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("hasSeenMobileNotice", () => {
  it("is false for a first-time visitor", () => {
    expect(hasSeenMobileNotice()).toBe(false);
  });

  it("reads a visit recorded by an earlier session", () => {
    window.localStorage.setItem("cairn.mobile-notice.v1.seen", "1");
    expect(hasSeenMobileNotice()).toBe(true);
  });

  it("counts as seen when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(hasSeenMobileNotice()).toBe(true);
  });
});

describe("markMobileNoticeSeen", () => {
  it("doesn't throw when storage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota full");
    });
    expect(() => markMobileNoticeSeen()).not.toThrow();
  });

  // A contract with browsers that have already dismissed the notice: renaming
  // the key would show it again to everyone. Pinning the literal is deliberate
  // (see AGENTS.md, Testing).
  it("records the visit under the cairn.mobile-notice.v1.seen key", () => {
    markMobileNoticeSeen();
    expect(window.localStorage.getItem("cairn.mobile-notice.v1.seen")).toBe("1");
  });

  it("round-trips with hasSeenMobileNotice", () => {
    markMobileNoticeSeen();
    expect(hasSeenMobileNotice()).toBe(true);
  });
});
