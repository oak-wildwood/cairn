import { describe, expect, it } from "vitest";
import { backupFileName, fileStamp } from "./backup";

describe("fileStamp", () => {
  it("formats as YYYY-MM-DD", () => {
    expect(fileStamp(new Date(2026, 7, 31))).toBe("2026-08-31");
  });

  it("zero-pads single-digit months and days", () => {
    expect(fileStamp(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("backupFileName", () => {
  it("names the file after the stamp", () => {
    expect(backupFileName(new Date(2026, 7, 31))).toBe(
      "cairn-map-2026-08-31.json",
    );
  });
});
