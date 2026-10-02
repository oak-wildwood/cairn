import { afterEach, describe, expect, it, vi } from "vitest";
import { fixtureFromQuery, makeFixtureMap } from "./devFixtures";
import { parseMap } from "./persistence";
import { SCHEMA_VERSION } from "./types";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("makeFixtureMap", () => {
  it.each([1, 2, 6, 13, 37])(
    "gives a map parseMap accepts whole, for %i parts",
    (count) => {
      const { parts, connections } = makeFixtureMap(count);
      const state = { schemaVersion: SCHEMA_VERSION, parts, connections };
      expect(parseMap(JSON.stringify(state))).toEqual(state);
    },
  );
});

describe("fixtureFromQuery", () => {
  it("clamps to 60", () => {
    const fixture = fixtureFromQuery("?parts=1000");
    expect(fixture?.parts).toHaveLength(60);
  });

  it("returns null for 0", () => {
    expect(fixtureFromQuery("?parts=0")).toBeNull();
  });

  it("returns null for a negative number", () => {
    expect(fixtureFromQuery("?parts=-5")).toBeNull();
  });

  it("returns null for a non-number", () => {
    expect(fixtureFromQuery("?parts=banana")).toBeNull();
  });

  it("returns null when ?parts is missing", () => {
    expect(fixtureFromQuery("")).toBeNull();
  });

  it("returns null outside dev", () => {
    vi.stubEnv("DEV", false);
    expect(fixtureFromQuery("?parts=5")).toBeNull();
  });
});
