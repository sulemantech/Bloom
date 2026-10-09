import { describe, expect, it } from "vitest";
import { resolveFlag } from "./flags-rule";

const PILOT = "c-pilot";
const OTHER = "c-other";

describe("resolveFlag", () => {
  it("is off when the flag is missing", () => {
    expect(resolveFlag([], PILOT)).toBe(false);
  });

  it("turns on for the pilot cohort only", () => {
    const flags = [{ cohort_id: PILOT, enabled: true }];
    expect(resolveFlag(flags, PILOT)).toBe(true);
    expect(resolveFlag(flags, OTHER)).toBe(false);
    expect(resolveFlag(flags)).toBe(false);
  });

  it("falls back to the global flag", () => {
    expect(resolveFlag([{ cohort_id: null, enabled: true }], OTHER)).toBe(true);
  });

  it("lets a cohort opt out of a global rollout", () => {
    const flags = [{ cohort_id: null, enabled: true }, { cohort_id: PILOT, enabled: false }];
    expect(resolveFlag(flags, PILOT)).toBe(false);
    expect(resolveFlag(flags, OTHER)).toBe(true);
  });

  it("uses the feature's default when nothing is set", () => {
    expect(resolveFlag([], PILOT, true)).toBe(true);
    expect(resolveFlag([{ cohort_id: null, enabled: false }], PILOT, true)).toBe(false);
  });
});
