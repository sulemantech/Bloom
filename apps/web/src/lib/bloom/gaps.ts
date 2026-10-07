/**
 * Explicit gaps and a guaranteed re-check (personalisation roadmap 2.5.2).
 *
 *   Teach → Check → Detect gap → Adapt next step → Re-check
 *
 * A gap is an idea the student hasn't shown they understand yet: a "nearly" or "not yet" answer. The
 * next step Spark writes must re-check open gaps. Spark is asked to (it writes better questions),
 * and these rules then verify its questions and add any missing re-check from a fixed template, so
 * the loop holds even when the model slips. Gaps close only through evidence (lib/bloom/learner).
 * Pure, so it is unit tested.
 */
import { checkAnswers, checkQuestions, checkReview, type CheckQuestion } from "./adaptive";
import { conceptKey, type Concept } from "./learner";

export type Gap = { idea: string; times: number; fresh: boolean };

/** Check questions per step, by path depth. */
export const CHECK_COUNT = { quick: 2, standard: 3, deep: 3 } as const;

/** Re-checks per step: one fewer than the questions, so every step still checks its own new idea. */
export const maxRechecks = (depth: keyof typeof CHECK_COUNT) => CHECK_COUNT[depth] - 1;

/**
 * The gaps the next step must re-check, most important first, at most `max`:
 * 1. ideas marked "not yet", then "nearly", in the review just done (freshest, weakest first);
 * 2. ideas still "struggling" from earlier steps of this path, most missed first.
 * A blank answer is no evidence, so it opens no gap.
 */
export function gapsToRecheck(
  openInPath: readonly Pick<Concept, "label" | "status" | "struggle_count">[],
  justReviewed: { check_questions: unknown; check_answers: unknown; check_review: unknown } | null,
  max: number,
): Gap[] {
  const fresh = new Map<string, Gap>();
  const weakest = new Map<string, number>(); // per idea: 2 = not yet, 1 = nearly
  const closedNow = new Set<string>();
  if (justReviewed) {
    const questions = checkQuestions(justReviewed.check_questions);
    const answers = checkAnswers(justReviewed.check_answers);
    const review = checkReview(justReviewed.check_review) ?? [];
    questions.forEach((q, i) => {
      const key = conceptKey(q.idea ?? "");
      const verdict = review[i]?.verdict;
      if (!key || !answers?.[i] || !verdict) return; // no idea, blank answer or no mark: no evidence
      if (verdict === "nailed") closedNow.add(key);
      else {
        if (!fresh.has(key)) fresh.set(key, { idea: q.idea!.trim(), times: 1, fresh: true });
        weakest.set(key, Math.max(weakest.get(key) ?? 0, verdict === "not_yet" ? 2 : 1));
      }
    });
  }

  // Weakest evidence first: "not yet" before "nearly" (stable, so question order breaks ties).
  const freshGaps = [...fresh.entries()].sort(([a], [b]) => (weakest.get(b) ?? 0) - (weakest.get(a) ?? 0)).map(([, g]) => g);

  const earlier: Gap[] = [];
  for (const c of [...openInPath].filter((c) => c.status === "struggling").sort((a, b) => b.struggle_count - a.struggle_count)) {
    const key = conceptKey(c.label);
    const now = fresh.get(key);
    if (now) now.times = c.struggle_count + 1; // missed again just now: count the earlier misses too
    else if (!closedNow.has(key)) earlier.push({ idea: c.label, times: c.struggle_count, fresh: false });
  }
  return [...freshGaps, ...earlier].slice(0, Math.max(0, max));
}

/** The fallback re-check question, used when Spark didn't re-check a gap itself. */
export function recheckQuestion(idea: string): CheckQuestion {
  return {
    kind: "apply",
    question: `Let's check this one again: explain "${idea}" in your own words, with a new example of your own.`,
    idea,
    recheck: true,
  };
}

/**
 * Makes sure every gap is re-checked: keeps Spark's re-check questions for the gaps (also a question
 * on a gap's idea that Spark forgot to mark), adds the template for any gap still missing, then fills
 * up with Spark's new questions to `count`. Re-checks come first; at least one new question stays
 * when Spark wrote one. Returns the final questions and the gaps that code had to add.
 */
export function enforceRechecks(checks: readonly CheckQuestion[], gaps: readonly Gap[], count: number): { questions: CheckQuestion[]; added: string[] } {
  const wanted = new Map(gaps.map((g) => [conceptKey(g.idea), g.idea]));
  const rechecks = new Map<string, CheckQuestion>();
  const fresh: CheckQuestion[] = [];
  for (const q of checks) {
    const key = conceptKey(q.idea ?? "");
    if (wanted.has(key)) {
      // Use the gap's exact name so the evidence lands on the same idea.
      if (!rechecks.has(key)) rechecks.set(key, { ...q, idea: wanted.get(key)!, recheck: true });
    } else {
      fresh.push({ ...q, recheck: false });
    }
  }
  const added: string[] = [];
  for (const [key, idea] of wanted) {
    if (!rechecks.has(key)) {
      rechecks.set(key, recheckQuestion(idea));
      added.push(idea);
    }
  }
  const recheckList = [...rechecks.values()].slice(0, fresh.length ? Math.max(0, count - 1) : count);
  return { questions: [...recheckList, ...fresh].slice(0, Math.max(count, recheckList.length)), added };
}
