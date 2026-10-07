import { describe, expect, it } from "vitest";
import { byNudgePriority, nudgeReasons, openGaps } from "./nudge";

const concept = (label: string, status: "struggling" | "understood", struggle_count: number, updated_at = "2026-10-01") => ({
  label,
  status,
  struggle_count,
  updated_at,
});

describe("openGaps", () => {
  it("lists only ideas still being struggled with, most missed first, then most recent", () => {
    expect(
      openGaps([
        concept("triggers", "struggling", 1, "2026-10-01"),
        concept("rewards", "understood", 3),
        concept("habit loop", "struggling", 3),
        concept("cues", "struggling", 1, "2026-10-05"),
      ]),
    ).toEqual([
      { idea: "habit loop", times: 3 },
      { idea: "cues", times: 1 },
      { idea: "triggers", times: 1 },
    ]);
  });
});

describe("nudgeReasons", () => {
  const fine = { overdue: 0, daysQuiet: 1, gaps: 0 };

  it("flags nobody who is on track", () => {
    expect(nudgeReasons(fine)).toEqual([]);
  });

  it("flags two open gaps, but not one", () => {
    expect(nudgeReasons({ ...fine, gaps: 1 })).toEqual([]);
    expect(nudgeReasons({ ...fine, gaps: 2 })).toEqual(["gaps"]);
  });

  it("flags two overdue activities, and a week without activity", () => {
    expect(nudgeReasons({ ...fine, overdue: 2 })).toEqual(["overdue"]);
    expect(nudgeReasons({ ...fine, daysQuiet: 7 })).toEqual(["quiet"]);
  });

  it("counts a student who was never active as quiet", () => {
    expect(nudgeReasons({ ...fine, daysQuiet: null })).toEqual(["quiet"]);
  });

  it("gives every reason that applies", () => {
    expect(nudgeReasons({ overdue: 3, daysQuiet: 10, gaps: 2 })).toEqual(["gaps", "overdue", "quiet"]);
  });
});

describe("byNudgePriority", () => {
  it("puts students with more reasons first, then more gaps, then more overdue work", () => {
    const list = [
      { name: "overdue only", reasons: ["overdue" as const], gaps: 0, overdue: 4 },
      { name: "gaps only", reasons: ["gaps" as const], gaps: 3, overdue: 0 },
      { name: "both", reasons: ["gaps" as const, "overdue" as const], gaps: 2, overdue: 2 },
    ];
    expect([...list].sort(byNudgePriority).map((s) => s.name)).toEqual(["both", "gaps only", "overdue only"]);
  });
});
