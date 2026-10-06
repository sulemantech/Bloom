/**
 * Adaptive steps: a planned path starts as an outline and Spark writes each step when the student
 * reaches it, from how the last one went. Pure, so it is unit tested.
 */

export type StepFeeling = "too_easy" | "just_right" | "too_hard";

export type AdaptiveTask = {
  id: string;
  position: number;
  kind: "learn" | "do" | "reflect";
  title: string;
  details: string;
  status: "todo" | "doing" | "done";
  reflection: string | null;
  feeling: StepFeeling | null;
  planned_only: boolean;
};

export type AdaptiveQuestion = { task_id: string | null; question: string; answer: string };

const byPosition = <T extends { position: number }>(tasks: readonly T[]) => [...tasks].sort((a, b) => a.position - b.position);
const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max)}…` : s);

/** The outline step Spark should write now: the first one, once every step before it is done. */
export function nextStepToWrite<T extends AdaptiveTask>(tasks: readonly T[]): T | null {
  const sorted = byPosition(tasks);
  const i = sorted.findIndex((t) => t.planned_only);
  if (i < 0) return null;
  return sorted.slice(0, i).every((t) => t.status === "done") ? sorted[i] : null;
}

/** What Spark is told when writing `target`: the outline, recent steps and how the last one went. */
export function stepWriterInput(
  path: { title: string; goal: string; summary: string },
  tasks: readonly AdaptiveTask[],
  questions: readonly AdaptiveQuestion[],
  targetId: string,
) {
  const sorted = byPosition(tasks);
  const at = sorted.findIndex((t) => t.id === targetId);
  if (at < 0) throw new Error("Step not in path");
  const target = sorted[at];
  const before = sorted.slice(0, at);
  const last = before.at(-1) ?? null;

  return {
    path: { title: path.title, goal: path.goal, summary: path.summary },
    outline: sorted.map((t, i) => ({
      step: i + 1,
      kind: t.kind,
      title: t.title,
      status: t.planned_only ? "not written yet" : t.status,
    })),
    recentSteps: before
      .filter((t) => !t.planned_only)
      .slice(-2)
      .map((t) => ({ step: sorted.indexOf(t) + 1, kind: t.kind, title: t.title, details: clip(t.details, 1500) })),
    lastStep: last && {
      title: last.title,
      feeling: last.feeling,
      note: last.reflection,
      questions: questions
        .filter((q) => q.task_id === last.id)
        .slice(-5)
        .map((q) => ({ question: q.question, answer: clip(q.answer, 400) })),
    },
    earlierFeelings: before
      .slice(0, -1)
      .map((t) => t.feeling)
      .filter((f): f is StepFeeling => f !== null),
    stepToWrite: { step: at + 1, kind: target.kind, title: target.title, aim: target.details },
  };
}

export type StepWriterInput = ReturnType<typeof stepWriterInput>;
