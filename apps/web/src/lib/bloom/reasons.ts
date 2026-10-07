/**
 * Why Spark changed a step, from stored evidence rather than the model's own sentence (roadmap 2.5.3).
 * Shown next to Spark's explanation, so every adapted step has a reason a person can check: the
 * feeling and answers on the step it was written from, the gaps it re-checks and the difficulty code
 * applied. Pure, so it is unit tested.
 */
import { checkAnswers, checkQuestions, checkReview, type StepFeeling } from "./adaptive";
import type { Difficulty } from "./learner";

export type AdaptationReason =
  | { kind: "feeling"; step: number; feeling: StepFeeling }
  | { kind: "answer"; step: number; question: number; verdict: "nearly" | "not_yet" }
  | { kind: "allNailed"; step: number }
  | { kind: "recheck"; idea: string }
  | { kind: "difficulty"; level: Exclude<Difficulty, "same"> };

export const DIFFICULTIES: readonly Difficulty[] = ["easier", "same", "harder"];

/** A stored difficulty value, or null if it isn't one. */
export const asDifficulty = (value: unknown): Difficulty | null => DIFFICULTIES.find((d) => d === value) ?? null;

/**
 * Reasons for a written step, in reading order: how the source step felt, its weak answers (or that
 * every answer was nailed), the gaps this step re-checks, and the difficulty applied when it isn't
 * "same". Blank answers say nothing, so they give no reason.
 */
export function adaptationReasons(
  source: { feeling: StepFeeling | null; check_questions: unknown; check_answers: unknown; check_review: unknown } | null,
  sourceNumber: number,
  target: { difficulty: unknown; check_questions: unknown },
): AdaptationReason[] {
  const reasons: AdaptationReason[] = [];
  if (source?.feeling) reasons.push({ kind: "feeling", step: sourceNumber, feeling: source.feeling });

  if (source) {
    const answers = checkAnswers(source.check_answers);
    const review = checkReview(source.check_review) ?? [];
    const answered = checkQuestions(source.check_questions)
      .map((_, i) => ({ i, verdict: answers?.[i] ? review[i]?.verdict : undefined }))
      .filter((a) => a.verdict);
    const weak = answered.filter((a) => a.verdict !== "nailed");
    for (const a of weak) reasons.push({ kind: "answer", step: sourceNumber, question: a.i + 1, verdict: a.verdict as "nearly" | "not_yet" });
    if (answered.length && !weak.length) reasons.push({ kind: "allNailed", step: sourceNumber });
  }

  for (const q of checkQuestions(target.check_questions)) if (q.recheck && q.idea) reasons.push({ kind: "recheck", idea: q.idea });

  const level = asDifficulty(target.difficulty);
  if (level && level !== "same") reasons.push({ kind: "difficulty", level });
  return reasons;
}
