// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { backupFileName, downloadMap, fileStamp } from "./backup";
import { parseMap } from "./persistence";
import { makePart } from "./testParts";
import { SCHEMA_VERSION, SELF_ID } from "./types";
import type { PersistedState } from "./types";

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

/** jsdom's `Blob` has no `.text()` - `FileReader` is its own file-api
 * sibling and does support reading one back. */
function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

describe("downloadMap", () => {
  // jsdom doesn't implement the object-URL statics at all, so there is no
  // original for `vi.spyOn` to wrap; they're installed for this block and
  // removed again afterwards so no other test inherits them.
  afterEach(() => {
    vi.restoreAllMocks();
    delete (URL as { createObjectURL?: unknown }).createObjectURL;
    delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL;
  });

  it("hands the browser a dated file that parseMap reads back unchanged", async () => {
    const state: PersistedState = {
      schemaVersion: SCHEMA_VERSION,
      parts: [makePart({ id: "a", feelings: ["sad", "tired"] })],
      connections: [
        { id: "c1", sourceId: SELF_ID, targetId: "a", label: "connected to" },
      ],
      ownerName: "Test User",
    };

    let blob: Blob | undefined;
    URL.createObjectURL = vi.fn((captured: Blob) => {
      blob = captured;
      return "blob:mock";
    });
    URL.revokeObjectURL = vi.fn();
    // The anchor is never attached to the document, but jsdom still runs a
    // real `<a>` click's navigation behavior; capture what it would have
    // downloaded instead.
    let downloadedAs: string | undefined;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function (this: HTMLAnchorElement) {
        downloadedAs = this.download;
      },
    );

    // A local-time date, matching how fileStamp reads it - a UTC midnight
    // would be the previous day anywhere west of Greenwich.
    downloadMap(state, new Date(2026, 7, 31));

    expect(downloadedAs).toBe("cairn-map-2026-08-31.json");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    expect(blob).toBeDefined();
    expect(parseMap(await readBlobText(blob!))).toEqual(state);
  });
});
