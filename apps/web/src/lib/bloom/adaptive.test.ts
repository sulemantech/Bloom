import { describe, expect, it } from "vitest";
import { nextStepToWrite, stepStates, stepWriterInput, type AdaptiveTask } from "./adaptive";

const task = (id: string, position: number, extra: Partial<AdaptiveTask> = {}): AdaptiveTask => ({
  id,
  position,
  kind: "do",
  title: `Step ${id}`,
  details: `Details ${id}`,
  status: "todo",
  reflection: null,
  feeling: null,
  planned_only: false,
  ...extra,
});

describe("nextStepToWrite", () => {
  it("is the first outline step once every step before it is done", () => {
    const tasks = [task("b", 2, { planned_only: true }), task("a", 1, { status: "done" }), task("c", 3, { planned_only: true })];
    expect(nextStepToWrite(tasks)?.id).toBe("b");
  });

  it("waits while an earlier step is unfinished", () => {
    expect(nextStepToWrite([task("a", 1, { status: "doing" }), task("b", 2, { planned_only: true })])).toBeNull();
  });

  it("is null when every step is written", () => {
    expect(nextStepToWrite([task("a", 1, { status: "done" }), task("b", 2)])).toBeNull();
  });
});

describe("stepStates", () => {
  it("marks the first unfinished step as current, even after a reopened earlier step", () => {
    const tasks = [task("a", 1, { status: "doing" }), task("b", 2, { status: "done" }), task("c", 3)];
    expect([...stepStates(tasks).entries()]).toEqual([["a", "current"], ["b", "done"], ["c", "upcoming"]]);
  });

  it("has no current step when every step is done", () => {
    expect([...stepStates([task("a", 1, { status: "done" })]).values()]).toEqual(["done"]);
  });
});

describe("stepWriterInput", () => {
  const path = { title: "Interviews", goal: "Ask good questions", summary: "Five steps." };

  it("passes how the last step went, with its questions, and earlier feelings", () => {
    const tasks = [
      task("a", 1, { status: "done", feeling: "just_right" }),
      task("b", 2, { status: "done", feeling: "too_hard", reflection: "Follow-up questions confused me" }),
      task("c", 3, { kind: "reflect", details: "Look back", planned_only: true }),
    ];
    const questions = [
      { task_id: "b", question: "What is a follow-up?", answer: "A question that builds on the answer." },
      { task_id: "a", question: "Other step", answer: "Not this one" },
    ];
    const input = stepWriterInput(path, tasks, questions, "c");

    expect(input.stepToWrite).toEqual({ step: 3, kind: "reflect", title: "Step c", aim: "Look back" });
    expect(input.lastStep).toEqual({
      step: 2,
      title: "Step b",
      feeling: "too_hard",
      note: "Follow-up questions confused me",
      questions: [{ question: "What is a follow-up?", answer: "A question that builds on the answer." }],
    });
    expect(input.earlierFeelings).toEqual(["just_right"]);
    expect(input.outline.map((s) => s.status)).toEqual(["done", "done", "not written yet"]);
  });

  it("uses the step the student just finished, even an earlier one they reopened", () => {
    const tasks = [
      task("a", 1, { status: "done", feeling: "too_hard", reflection: "I did not understand it" }),
      task("b", 2, { status: "done", feeling: "too_easy" }),
      task("c", 3, { planned_only: true }),
    ];
    const input = stepWriterInput(path, tasks, [], "c", "a");
    expect(input.lastStep).toMatchObject({ step: 1, feeling: "too_hard", note: "I did not understand it" });
    expect(input.earlierFeelings).toEqual(["too_easy"]);
  });

  it("keeps notes from other earlier steps", () => {
    const tasks = [
      task("a", 1, { status: "done", feeling: "too_hard", reflection: "Confused by loops" }),
      task("b", 2, { status: "done", feeling: "just_right" }),
      task("c", 3, { planned_only: true }),
    ];
    expect(stepWriterInput(path, tasks, [], "c").earlierNotes).toEqual([{ step: 1, feeling: "too_hard", note: "Confused by loops" }]);
  });

  it("sends only the last two written steps, clipped", () => {
    const tasks = [
      task("a", 1, { status: "done" }),
      task("b", 2, { status: "done" }),
      task("c", 3, { status: "done", details: "x".repeat(2000) }),
      task("d", 4, { planned_only: true }),
    ];
    const recent = stepWriterInput(path, tasks, [], "d").recentSteps;
    expect(recent.map((s) => s.step)).toEqual([2, 3]);
    expect(recent[1].details).toHaveLength(1501);
  });

  it("has no last step for the first step", () => {
    expect(stepWriterInput(path, [task("a", 1, { planned_only: true })], [], "a").lastStep).toBeNull();
  });
});
