import { describe, expect, it } from "vitest";
import { summariseUsage, topStudents, usageWindow, type DayRow, type StudentRow } from "./usage";

const row = (r: Partial<DayRow> & Pick<DayRow, "day" | "outcome" | "calls">): DayRow => ({
  capability: "bloom_ask",
  input_tokens: 0,
  output_tokens: 0,
  latency_ms_total: 0,
  latency_calls: 0,
  ...r,
});

describe("usageWindow", () => {
  it("lists the days newest first, in the viewer's time zone", () => {
    // 20:00 UTC on 5 Oct is already 6 Oct in Karachi (UTC+5).
    const { days, since } = usageWindow(3, "Asia/Karachi", new Date("2026-10-05T20:00:00Z"));
    expect(days).toEqual(["2026-10-06", "2026-10-05", "2026-10-04"]);
    expect(since).toBe("2026-10-03T19:00:00.000Z");
  });
});

describe("summariseUsage", () => {
  const days = ["2026-10-05", "2026-10-04"];
  const summary = summariseUsage(
    [
      row({ day: "2026-10-05", outcome: "ok", calls: 4, input_tokens: 4000, output_tokens: 800, latency_ms_total: 8000, latency_calls: 4 }),
      row({ day: "2026-10-05", outcome: "failed", calls: 1, latency_ms_total: 2000, latency_calls: 1 }),
      row({ day: "2026-10-05", outcome: "limited", calls: 2 }),
      row({ day: "2026-10-05", outcome: "no_consent", calls: 3 }),
      row({ day: "2026-10-05", capability: "progress_card", outcome: "ok", calls: 1, input_tokens: 500, output_tokens: 200 }),
    ],
    days,
  );

  it("counts only calls that reached the model", () => {
    expect(summary.total).toMatchObject({ calls: 6, notAnswered: 1, limited: 2, inputTokens: 4500, outputTokens: 1000 });
  });

  it("averages model time over timed calls", () => {
    expect(summary.total.avgLatencyMs).toBe(2000);
  });

  it("keeps days without usage", () => {
    expect(summary.days.map((d) => d.day)).toEqual(days);
    expect(summary.days[1]).toMatchObject({ calls: 0, avgLatencyMs: null });
  });

  it("splits by capability, busiest first", () => {
    expect(summary.capabilities.map((c) => [c.capability, c.calls])).toEqual([["bloom_ask", 5], ["progress_card", 1]]);
  });
});

describe("topStudents", () => {
  const s = (student_id: string, outcome: string, calls: number): StudentRow => ({ student_id, outcome, calls, input_tokens: 0, output_tokens: 0 });

  it("ranks by calls, then limit hits, and skips students who were only refused for consent", () => {
    const top = topStudents([s("a", "ok", 3), s("b", "ok", 9), s("b", "limited", 2), s("c", "limited", 1), s("d", "no_consent", 5)]);
    expect(top.map((t) => [t.studentId, t.calls, t.limited])).toEqual([["b", 9, 2], ["a", 3, 0], ["c", 0, 1]]);
  });

  it("returns at most the limit", () => {
    expect(topStudents([s("a", "ok", 1), s("b", "ok", 2)], 1)).toHaveLength(1);
  });
});
