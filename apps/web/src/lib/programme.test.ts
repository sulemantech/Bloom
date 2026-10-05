import { describe, expect, it } from "vitest";
import { currentWeek, stageForWeek } from "./programme";

const STAGES = [
  { key: "explore", week_from: 1, week_to: 2 },
  { key: "choose", week_from: 3, week_to: 4 },
  { key: "build", week_from: 5, week_to: 6 },
  { key: "present", week_from: 7, week_to: 8 },
];

describe("currentWeek", () => {
  const at = (iso: string) => new Date(iso);

  it("is null until the cohort has a start date", () => {
    expect(currentWeek(null, "Asia/Karachi", 8)).toBeNull();
  });

  it("is 0 before the start, then counts weeks from day one", () => {
    expect(currentWeek("2026-10-10", "Asia/Karachi", 8, at("2026-10-09T12:00:00Z"))).toBe(0);
    expect(currentWeek("2026-10-10", "Asia/Karachi", 8, at("2026-10-10T12:00:00Z"))).toBe(1);
    expect(currentWeek("2026-10-10", "Asia/Karachi", 8, at("2026-10-16T12:00:00Z"))).toBe(1);
    expect(currentWeek("2026-10-10", "Asia/Karachi", 8, at("2026-10-17T12:00:00Z"))).toBe(2);
  });

  it("uses the cohort's time zone, not UTC", () => {
    // 20:00 UTC on the 9th is already 01:00 on the 10th in Karachi (UTC+5).
    expect(currentWeek("2026-10-10", "Asia/Karachi", 8, at("2026-10-09T20:00:00Z"))).toBe(1);
    expect(currentWeek("2026-10-10", "UTC", 8, at("2026-10-09T20:00:00Z"))).toBe(0);
  });

  it("stops at weeks + 1 after the programme ends", () => {
    expect(currentWeek("2026-01-01", "Asia/Karachi", 8, at("2026-12-01T12:00:00Z"))).toBe(9);
  });
});

describe("stageForWeek", () => {
  it("finds the stage that contains the week", () => {
    expect(stageForWeek(STAGES, 1)?.key).toBe("explore");
    expect(stageForWeek(STAGES, 4)?.key).toBe("choose");
    expect(stageForWeek(STAGES, 8)?.key).toBe("present");
  });

  it("returns nothing outside the programme", () => {
    expect(stageForWeek(STAGES, 0)).toBeUndefined();
    expect(stageForWeek(STAGES, 9)).toBeUndefined();
  });
});
