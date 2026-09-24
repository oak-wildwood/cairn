import { describe, expect, it } from "vitest";
import { backupFileName, fileStamp } from "./backup";

describe("fileStamp", () => {
  it("zero-pads month and day so it sorts chronologically", () => {
    expect(fileStamp(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("does not pad the year", () => {
    expect(fileStamp(new Date(2026, 8, 24))).toBe("2026-09-24");
  });
});

describe("backupFileName", () => {
  it("wraps the date stamp in the shared file naming scheme", () => {
    expect(backupFileName(new Date(2026, 0, 5))).toBe("cairn-map-2026-01-05.json");
  });
});
