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

/** The step whose feedback `target` is written from: the one just finished, else the one before it. */
export function lastFinishedStep<T extends AdaptiveTask>(tasks: readonly T[], targetId: string, finishedId?: string): T | null {
  const sorted = byPosition(tasks);
  const before = sorted.slice(0, sorted.findIndex((t) => t.id === targetId));
  return before.find((t) => t.id === finishedId) ?? before.at(-1) ?? null;
}

export type StepState = "done" | "current" | "upcoming";

/** Where each step stands for the student: done, the one to do now (the first unfinished), or later. */
export function stepStates<T extends { id: string; position: number; status: string }>(tasks: readonly T[]): Map<string, StepState> {
  const sorted = byPosition(tasks);
  const current = sorted.find((t) => t.status !== "done");
  return new Map(sorted.map((t) => [t.id, t.status === "done" ? "done" : t === current ? "current" : "upcoming"]));
}

/**
 * What Spark is told when writing `target`: the outline, recent steps and how the last one went.
 * The "last step" is the one the student just finished (`finishedId`), which may be an earlier step
 * they reopened; otherwise the step right before the target. Notes on other earlier steps are
 * passed too, so no feedback is lost.
 */
export function stepWriterInput(
  path: { title: string; goal: string; summary: string },
  tasks: readonly AdaptiveTask[],
  questions: readonly AdaptiveQuestion[],
  targetId: string,
  finishedId?: string,
) {
  const sorted = byPosition(tasks);
  const at = sorted.findIndex((t) => t.id === targetId);
  if (at < 0) throw new Error("Step not in path");
  const target = sorted[at];
  const before = sorted.slice(0, at);
  const last = lastFinishedStep(tasks, targetId, finishedId);
  const others = before.filter((t) => t !== last);

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
      step: sorted.indexOf(last) + 1,
      title: last.title,
      feeling: last.feeling,
      note: last.reflection,
      questions: questions
        .filter((q) => q.task_id === last.id)
        .slice(-5)
        .map((q) => ({ question: q.question, answer: clip(q.answer, 400) })),
    },
    earlierFeelings: others.map((t) => t.feeling).filter((f): f is StepFeeling => f !== null),
    earlierNotes: others
      .filter((t) => t.reflection)
      .slice(-3)
      .map((t) => ({ step: sorted.indexOf(t) + 1, feeling: t.feeling, note: clip(t.reflection ?? "", 500) })),
    stepToWrite: { step: at + 1, kind: target.kind, title: target.title, aim: target.details },
  };
}

export type StepWriterInput = ReturnType<typeof stepWriterInput>;
