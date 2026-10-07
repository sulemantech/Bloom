/**
 * When a mentor should step in (roadmap 2.5.5). Spark adapts on its own, but a student who keeps
 * missing the same ideas, falls behind or goes quiet needs a person. Code decides who is flagged and
 * why, from stored evidence, so mentors see the same list for the same facts and every flag has a
 * reason they can check. The AI never flags a student.
 */
import type { Concept } from "./learner";

/** Thresholds for "may need a nudge". */
export const NUDGE_RULES = {
  /** Course activities overdue. */
  overdue: 2,
  /** Days without any activity (submissions or Spark). */
  quietDays: 7,
  /** Ideas the student is still struggling with (open gaps). */
  openGaps: 2,
} as const;

export type OpenGap = { idea: string; times: number };
export type NudgeReason = "gaps" | "overdue" | "quiet";

/** Open gaps, the most missed first, then the most recent: what a mentor should look at first. */
export function openGaps(concepts: readonly Pick<Concept, "label" | "status" | "struggle_count" | "updated_at">[]): OpenGap[] {
  return concepts
    .filter((c) => c.status === "struggling")
    .sort((a, b) => b.struggle_count - a.struggle_count || (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))
    .map((c) => ({ idea: c.label, times: c.struggle_count }));
}

/**
 * Why a student may need a nudge (empty: they don't). `daysQuiet` is null when they have never been
 * active, which counts as quiet.
 */
export function nudgeReasons({ overdue, daysQuiet, gaps }: { overdue: number; daysQuiet: number | null; gaps: number }): NudgeReason[] {
  const reasons: NudgeReason[] = [];
  if (gaps >= NUDGE_RULES.openGaps) reasons.push("gaps");
  if (overdue >= NUDGE_RULES.overdue) reasons.push("overdue");
  if (daysQuiet === null || daysQuiet >= NUDGE_RULES.quietDays) reasons.push("quiet");
  return reasons;
}

/** Order for the nudge list: most reasons first, then most open gaps, then most overdue work. */
export function byNudgePriority(
  a: { reasons: readonly NudgeReason[]; gaps: number; overdue: number },
  b: { reasons: readonly NudgeReason[]; gaps: number; overdue: number },
) {
  return b.reasons.length - a.reasons.length || b.gaps - a.gaps || b.overdue - a.overdue;
}
