import { describe, expect, it } from "vitest";
import { cardsRead, feedbackStats, groupDuties, isLateReview, latestWork, median, mentorFlags } from "./operations";

const now = new Date("2026-10-08T12:00:00Z");
const ago = (days: number, hours = 0) => new Date(now.getTime() - days * 86_400_000 - hours * 3_600_000).toISOString();

describe("latestWork", () => {
  it("keeps only the newest submission per student and activity", () => {
    const rows = [
      { id: "old", student_id: "s1", activity_id: "a1", submitted_at: ago(5), status: "needs_changes" },
      { id: "new", student_id: "s1", activity_id: "a1", submitted_at: ago(1), status: "submitted" },
      { id: "other", student_id: "s2", activity_id: "a1", submitted_at: ago(3), status: "done" },
    ];
    expect(latestWork(rows).map((r) => r.id).sort()).toEqual(["new", "other"]);
  });
});

describe("isLateReview", () => {
  it("flags work waiting more than 3 days, not reviewed work", () => {
    expect(isLateReview({ status: "submitted", submitted_at: ago(3) }, now)).toBe(false);
    expect(isLateReview({ status: "submitted", submitted_at: ago(4) }, now)).toBe(true);
    expect(isLateReview({ status: "done", submitted_at: ago(10) }, now)).toBe(false);
  });
});

describe("groupDuties", () => {
  const base = { id: "g", name: "Lahore", weeks: 8, studentIds: ["s1", "s2", "s3"], waiting: [], approvedCards: [] };

  it("counts waiting and late reviews and the oldest wait", () => {
    const d = groupDuties({ ...base, week: 3, waiting: [{ submitted_at: ago(1) }, { submitted_at: ago(5) }] }, now);
    expect([d.waiting, d.late, d.oldestDays]).toEqual([2, 1, 5]);
  });

  it("asks for last week's cards from week 2 on, and counts the ones not sent", () => {
    expect(groupDuties({ ...base, week: 1 }, now).cardWeek).toBeNull();
    const d = groupDuties({ ...base, week: 4, approvedCards: [{ student_id: "s1", week: 3 }, { student_id: "s2", week: 2 }] }, now);
    expect([d.cardWeek, d.cardsMissing]).toEqual([3, 2]);
  });

  it("owes nothing before the group starts", () => {
    const d = groupDuties({ ...base, week: 0 }, now);
    expect([d.cardWeek, d.cardsMissing, d.oldestDays]).toEqual([null, 0, null]);
  });
});

describe("mentorFlags", () => {
  const fine = groupDuties({ id: "g", name: "G", week: 3, weeks: 8, studentIds: [], waiting: [], approvedCards: [] }, now);

  it("is empty for a mentor on top of things", () => {
    expect(mentorFlags({ groups: [fine], lastSignInAt: ago(1) }, now)).toEqual([]);
  });

  it("names late reviews, missing cards, quiet and missing groups", () => {
    const busy = { ...fine, late: 2, cardsMissing: 3 };
    expect(mentorFlags({ groups: [busy], lastSignInAt: ago(8) }, now)).toEqual(["late_reviews", "cards_due", "quiet"]);
    expect(mentorFlags({ groups: [], lastSignInAt: null }, now)).toEqual(["no_group", "never_signed_in"]);
  });
});

describe("feedbackStats and median", () => {
  it("counts last week's feedback and the median response time in hours", () => {
    const stats = feedbackStats(
      [
        { created_at: ago(1), submitted_at: ago(2) }, // 24 h
        { created_at: ago(2), submitted_at: ago(2, 6) }, // 6 h
        { created_at: ago(10), submitted_at: ago(13) }, // 72 h, not in the last week
      ],
      now,
    );
    expect(stats).toEqual({ lastWeek: 2, medianHours: 24 });
  });

  it("returns null for no data, and averages the middle pair", () => {
    expect(median([])).toBeNull();
    expect(median([1, 3, 5, 7])).toBe(4);
  });
});

describe("cardsRead", () => {
  it("counts approved cards and the ones a parent opened; drafts don't count", () => {
    expect(
      cardsRead([
        { status: "approved", viewed_at: ago(1) },
        { status: "approved", viewed_at: null },
        { status: "draft", viewed_at: null },
      ]),
    ).toEqual({ sent: 2, read: 1 });
  });
});
