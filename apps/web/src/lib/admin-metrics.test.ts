import { describe, expect, it } from "vitest";
import { ageInDays, feeSummary, onTrack, rupees } from "./admin-metrics";

describe("feeSummary", () => {
  it("adds paid fees as collected and unpaid ones as outstanding, ignoring mentors and refunds", () => {
    expect(
      feeSummary([
        { role: "student", fee_amount: 15000, paid_at: "2026-10-01", refunded_at: null },
        { role: "student", fee_amount: "12000.00", paid_at: "2026-10-01", refunded_at: null, discount_reason: "sibling" },
        { role: "student", fee_amount: 15000, paid_at: null, refunded_at: null },
        { role: "student", fee_amount: 15000, paid_at: "2026-10-01", refunded_at: "2026-10-03" },
        { role: "mentor", fee_amount: null, paid_at: null, refunded_at: null },
      ]),
    ).toEqual({ collected: 27000, outstanding: 15000, unpaid: 1, discounts: 1 });
  });
});

describe("onTrack", () => {
  it("counts students with nothing overdue", () => {
    expect(onTrack([{ overdue: 0 }, { overdue: 2 }, { overdue: 0 }, { overdue: 1 }])).toEqual({ done: 2, total: 4, percent: 50 });
  });

  it("treats an empty group as on track", () => {
    expect(onTrack([]).percent).toBe(100);
  });
});

describe("ageInDays and rupees", () => {
  it("counts whole days, never negative", () => {
    const now = new Date("2026-10-08T12:00:00Z");
    expect(ageInDays("2026-10-05T13:00:00Z", now)).toBe(2);
    expect(ageInDays("2026-10-09T00:00:00Z", now)).toBe(0);
    expect(ageInDays(null, now)).toBeNull();
  });

  it("formats rupees with thousands separators", () => {
    expect(rupees(180000)).toBe("180,000");
  });
});
