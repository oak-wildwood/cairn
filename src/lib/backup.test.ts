import { describe, expect, it } from "vitest";
import { backupFileName, fileStamp } from "./backup";

describe("fileStamp", () => {
  it("formats as YYYY-MM-DD, zero-padded, so it sorts chronologically", () => {
    expect(fileStamp(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(fileStamp(new Date(2026, 10, 21))).toBe("2026-11-21");
  });
});

describe("backupFileName", () => {
  it("wraps the stamp in the cairn-map filename", () => {
    expect(backupFileName(new Date(2026, 7, 31))).toBe(
      "cairn-map-2026-08-31.json",
    );
  });
});
