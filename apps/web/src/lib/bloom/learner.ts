/**
 * The learner state: what Spark knows about a student's learning. The AI only names the idea each
 * check question tests and drafts a verdict; these rules decide what the student understands, what
 * they struggle with, how hard the next step should be and what they need next. Pure, so it is unit
 * tested and the same evidence always gives the same state.
 */
import { checkAnswers, checkQuestions, checkReview, type StepFeeling, type Verdict } from "./adaptive";
import { openGaps } from "./nudge";

export type ConceptStatus = "struggling" | "understood";

export type Concept = {
  key: string;
  label: string;
  status: ConceptStatus;
  struggle_count: number;
  nailed_count: number;
  updated_at?: string;
};

/** Normalised name, so "Habit triggers" and "habit-triggers!" are the same idea. */
export function conceptKey(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/**
 * Updates the concepts a reviewed step gives evidence about. Rules: an answered question marked
 * "nailed" counts as understanding; "nearly" or "not yet" counts as a struggle; a blank answer is
 * no evidence. The status follows the latest evidence. Returns only the concepts that changed.
 */
export function applyReview(existing: readonly Concept[], step: { check_questions: unknown; check_answers: unknown; check_review: unknown }): Concept[] {
  const questions = checkQuestions(step.check_questions);
  const answers = checkAnswers(step.check_answers);
  const review = checkReview(step.check_review);
  if (!review) return [];

  const byKey = new Map(existing.map((c) => [c.key, { ...c }]));
  const changed = new Map<string, Concept>();
  questions.forEach((q, i) => {
    const label = (q.idea ?? "").trim().slice(0, 80);
    const key = conceptKey(label);
    const verdict = review[i]?.verdict;
    if (!key || !verdict || !answers?.[i]) return;
    const concept = byKey.get(key) ?? { key, label, status: "struggling" as ConceptStatus, struggle_count: 0, nailed_count: 0 };
    if (verdict === "nailed") {
      concept.nailed_count += 1;
      concept.status = "understood";
    } else {
      concept.struggle_count += 1;
      concept.status = "struggling";
    }
    byKey.set(key, concept);
    changed.set(key, concept);
  });
  return [...changed.values()];
}

export type Difficulty = "easier" | "same" | "harder";

const FEELING_SCORE: Record<StepFeeling, number> = { too_hard: -1, just_right: 0, too_easy: 1 };
const VERDICT_SCORE: Record<Verdict, number> = { not_yet: -1, nearly: 0, nailed: 1 };
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * How hard the next step should be, from the student's last finished steps (newest first; the
 * first 3 count). Each step scores -1…1 from its feeling and its marked answers; the average decides:
 * at or below -⅓ → easier, at or above ⅓ → harder, otherwise the same.
 */
export function preferredDifficulty(
  steps: readonly { feeling: StepFeeling | null; check_answers?: unknown; check_review?: unknown }[],
): { level: Difficulty; basedOn: number } {
  const scores = steps.slice(0, 3).flatMap((step) => {
    const answers = checkAnswers(step.check_answers);
    const review = checkReview(step.check_review) ?? [];
    const marks = review.flatMap((r, i) => (answers?.[i] ? [VERDICT_SCORE[r.verdict]] : []));
    const parts = [step.feeling ? FEELING_SCORE[step.feeling] : null, mean(marks)].filter((p): p is number => p !== null);
    const score = mean(parts);
    return score === null ? [] : [score];
  });
  const average = mean(scores);
  const level: Difficulty = average === null ? "same" : average <= -1 / 3 ? "easier" : average >= 1 / 3 ? "harder" : "same";
  return { level, basedOn: scores.length };
}

export type NextNeed = { kind: "practise"; idea: string } | { kind: "activity"; title: string; week: number; overdue: boolean } | null;

/** The most pressing need: the idea struggled with most (then most recently), otherwise course work. */
export function nextNeed(concepts: readonly Concept[], course: { title: string; week: number; overdue: boolean } | null): NextNeed {
  const [gap] = openGaps(concepts);
  if (gap) return { kind: "practise", idea: gap.idea };
  return course ? { kind: "activity", ...course } : null;
}

export type LearnerState = {
  understands: string[];
  strugglesWith: { idea: string; times: number }[];
  difficulty: Difficulty;
  nextNeed: NextNeed;
};

/** The learner state as shown to people and given to Spark (most recent first, capped). */
export function learnerState(
  concepts: readonly Concept[],
  recentSteps: Parameters<typeof preferredDifficulty>[0],
  course: Parameters<typeof nextNeed>[1],
): LearnerState {
  const recent = [...concepts].sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
  return {
    understands: recent.filter((c) => c.status === "understood").slice(0, 8).map((c) => c.label),
    strugglesWith: openGaps(concepts).slice(0, 5),
    difficulty: preferredDifficulty(recentSteps).level,
    nextNeed: nextNeed(concepts, course),
  };
}
