import { describe, expect, it } from "vitest";
import { backupFileName, fileStamp } from "./backup";

describe("fileStamp", () => {
  it("pads month and day to two digits", () => {
    expect(fileStamp(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("sorts chronologically by construction", () => {
    expect(fileStamp(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("backupFileName", () => {
  it("names the file after the stamp", () => {
    expect(backupFileName(new Date(2026, 0, 5))).toBe(
      "cairn-map-2026-01-05.json",
    );
  });
});
