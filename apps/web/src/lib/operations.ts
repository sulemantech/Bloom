/**
 * Operations rules for admins: when mentor work is late, how a mentor's workload is summed up, and
 * how engaged families are. Pure, so the service levels are unit tested and every admin screen shows
 * the same numbers for the same facts.
 */

/** Service levels the course promises. One place to change them. */
export const SERVICE_LEVELS = {
  /** A submission should get feedback within this many days. */
  reviewDays: 3,
  /** A mentor who hasn't signed in for this many days is flagged. */
  mentorQuietDays: 7,
} as const;

const DAY = 86_400_000;

/** The current time, for server pages (kept out of render code so it stays one explicit read). */
export const clock = () => new Date();

/** Whole days between two moments (0 on the same day), never negative. */
export const daysBetween = (fromIso: string, now: Date) => Math.max(0, Math.floor((now.getTime() - Date.parse(fromIso)) / DAY));

// ---------------------------------------------------------------------------
// Submissions: the current state of each piece of work
// ---------------------------------------------------------------------------

export type WorkStatus = "submitted" | "needs_changes" | "done";

/**
 * The latest submission per student and activity. Resubmitting creates a new row, so older rows
 * describe work that has since been replaced and must not count as waiting.
 */
export function latestWork<T extends { student_id: string; activity_id: string; submitted_at: string }>(rows: readonly T[]): T[] {
  const latest = new Map<string, T>();
  for (const row of rows) {
    const key = `${row.student_id}:${row.activity_id}`;
    const seen = latest.get(key);
    if (!seen || row.submitted_at > seen.submitted_at) latest.set(key, row);
  }
  return [...latest.values()];
}

/** Waiting for feedback longer than the service level. */
export const isLateReview = (row: { status: string; submitted_at: string }, now: Date) =>
  row.status === "submitted" && daysBetween(row.submitted_at, now) > SERVICE_LEVELS.reviewDays;

/** Median of a list (null when empty). */
export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ---------------------------------------------------------------------------
// Groups and mentors
// ---------------------------------------------------------------------------

export type GroupDuties = {
  id: string;
  name: string;
  week: number | null;
  weeks: number;
  students: number;
  /** Work waiting for feedback, and how many days the oldest has waited. */
  waiting: number;
  late: number;
  oldestDays: number | null;
  /** The finished week whose progress cards are due, and how many are still not sent. */
  cardWeek: number | null;
  cardsMissing: number;
};

/**
 * What a group's mentors owe right now. Reviews and cards belong to the group, not to one mentor:
 * co-mentors share them, so the same duties show on each of their rows.
 */
export function groupDuties(
  group: {
    id: string;
    name: string;
    week: number | null;
    weeks: number;
    studentIds: readonly string[];
    waiting: readonly { submitted_at: string }[];
    approvedCards: readonly { student_id: string; week: number }[];
  },
  now: Date,
): GroupDuties {
  const oldest = group.waiting.map((w) => w.submitted_at).sort()[0];
  // Cards are written at the end of each week, so the one due is for the last finished week.
  const cardWeek = group.week !== null && group.week >= 2 ? Math.min(group.week - 1, group.weeks) : null;
  const sent = new Set(group.approvedCards.filter((c) => c.week === cardWeek).map((c) => c.student_id));
  return {
    id: group.id,
    name: group.name,
    week: group.week,
    weeks: group.weeks,
    students: group.studentIds.length,
    waiting: group.waiting.length,
    late: group.waiting.filter((w) => daysBetween(w.submitted_at, now) > SERVICE_LEVELS.reviewDays).length,
    oldestDays: oldest ? daysBetween(oldest, now) : null,
    cardWeek,
    cardsMissing: cardWeek === null ? 0 : group.studentIds.filter((id) => !sent.has(id)).length,
  };
}

export type MentorFlag = "late_reviews" | "cards_due" | "quiet" | "no_group" | "never_signed_in";

/** Why a mentor may need a word from operations (empty: all good). */
export function mentorFlags(
  m: { groups: readonly GroupDuties[]; lastSignInAt: string | null },
  now: Date,
): MentorFlag[] {
  const flags: MentorFlag[] = [];
  if (!m.groups.length) flags.push("no_group");
  if (m.groups.some((g) => g.late > 0)) flags.push("late_reviews");
  if (m.groups.some((g) => g.cardsMissing > 0)) flags.push("cards_due");
  if (!m.lastSignInAt) flags.push("never_signed_in");
  else if (daysBetween(m.lastSignInAt, now) >= SERVICE_LEVELS.mentorQuietDays) flags.push("quiet");
  return flags;
}

/** Feedback a mentor gave: how many in the last 7 days, and the median hours from submission to feedback. */
export function feedbackStats(
  feedback: readonly { created_at: string; submitted_at: string | null }[],
  now: Date,
): { lastWeek: number; medianHours: number | null } {
  const lastWeek = feedback.filter((f) => now.getTime() - Date.parse(f.created_at) < 7 * DAY).length;
  const hours = feedback
    .filter((f) => f.submitted_at)
    .map((f) => Math.max(0, (Date.parse(f.created_at) - Date.parse(f.submitted_at!)) / 3_600_000));
  const m = median(hours);
  return { lastWeek, medianHours: m === null ? null : Math.round(m) };
}

// ---------------------------------------------------------------------------
// Families
// ---------------------------------------------------------------------------

/** Progress cards parents have received (approved) and opened. */
export function cardsRead(cards: readonly { status: string; viewed_at: string | null }[]) {
  const sent = cards.filter((c) => c.status === "approved");
  return { sent: sent.length, read: sent.filter((c) => c.viewed_at).length };
}
