import { describe, expect, it } from "vitest";
import { enforceRechecks, gapsToRecheck, recheckQuestion } from "./gaps";

const reviewed = (verdicts: (string | null)[], answers: string[]) => ({
  check_questions: [
    { kind: "apply", question: "Q1", idea: "Habit triggers" },
    { kind: "judge", question: "Q2", idea: "Habit loop" },
    { kind: "apply", question: "Q3", idea: "Rewards" },
  ].slice(0, verdicts.length),
  check_answers: answers,
  check_review: verdicts.map((v) => (v ? { verdict: v } : null)),
});

describe("gapsToRecheck", () => {
  it("opens a gap for each nearly / not yet answer, not for nailed or blank ones", () => {
    expect(gapsToRecheck([], reviewed(["nailed", "not_yet", "nearly"], ["a", "b", ""]), 5)).toEqual([
      { idea: "Habit loop", times: 1, fresh: true },
    ]);
  });

  it("puts fresh gaps first, then earlier ones in this path, most missed first", () => {
    const open = [
      { label: "Rewards", status: "struggling" as const, struggle_count: 1 },
      { label: "Users", status: "struggling" as const, struggle_count: 3 },
      { label: "Pricing", status: "understood" as const, struggle_count: 2 },
    ];
    expect(gapsToRecheck(open, reviewed(["not_yet"], ["x"]), 5).map((g) => g.idea)).toEqual(["Habit triggers", "Users", "Rewards"]);
  });

  it("counts earlier misses when an idea is missed again", () => {
    const open = [{ label: "habit-triggers", status: "struggling" as const, struggle_count: 2 }];
    expect(gapsToRecheck(open, reviewed(["not_yet"], ["x"]), 5)).toEqual([{ idea: "Habit triggers", times: 3, fresh: true }]);
  });

  it("closes an earlier gap that was nailed just now", () => {
    const open = [{ label: "Habit triggers", status: "struggling" as const, struggle_count: 2 }];
    expect(gapsToRecheck(open, reviewed(["nailed"], ["x"]), 5)).toEqual([]);
  });

  it("keeps an earlier gap open when its re-check was left blank", () => {
    const open = [{ label: "Habit triggers", status: "struggling" as const, struggle_count: 2 }];
    expect(gapsToRecheck(open, reviewed(["not_yet"], [""]), 5)).toEqual([{ idea: "Habit triggers", times: 2, fresh: false }]);
  });

  it("re-checks the weakest answers first: not yet before nearly", () => {
    expect(gapsToRecheck([], reviewed(["nearly", "not_yet"], ["a", "b"]), 1).map((g) => g.idea)).toEqual(["Habit loop"]);
  });

  it("respects the cap; the rest wait for a later step", () => {
    const open = [{ label: "Users", status: "struggling" as const, struggle_count: 3 }];
    expect(gapsToRecheck(open, reviewed(["not_yet", "nearly"], ["a", "b"]), 2).map((g) => g.idea)).toEqual(["Habit triggers", "Habit loop"]);
    expect(gapsToRecheck(open, null, 0)).toEqual([]);
  });
});

describe("enforceRechecks", () => {
  const gap = (idea: string) => ({ idea, times: 1, fresh: true });
  const q = (idea: string, recheck = false) => ({ kind: "apply" as const, question: `About ${idea}`, idea, recheck });

  it("keeps Spark's re-check and its new question when both are there", () => {
    expect(enforceRechecks([q("Habit loop", true), q("Pricing")], [gap("Habit loop")], 2)).toEqual({
      questions: [q("Habit loop", true), q("Pricing")],
      added: [],
    });
  });

  it("treats a question on a gap's idea as its re-check, using the gap's exact name", () => {
    const { questions, added } = enforceRechecks([q("pricing"), q("habit-loop")], [gap("Habit loop")], 2);
    expect(questions[0]).toEqual({ ...q("habit-loop", true), idea: "Habit loop" });
    expect(questions[1]).toEqual(q("pricing"));
    expect(added).toEqual([]);
  });

  it("adds the template re-check when Spark forgot one, keeping a new question", () => {
    const { questions, added } = enforceRechecks([q("Pricing"), q("Users")], [gap("Habit loop")], 2);
    expect(questions).toEqual([recheckQuestion("Habit loop"), q("Pricing")]);
    expect(added).toEqual(["Habit loop"]);
  });

  it("leaves room for at least one new question when Spark wrote one", () => {
    const { questions } = enforceRechecks([q("Pricing")], [gap("A"), gap("B"), gap("C")], 3);
    expect(questions.map((x) => [x.idea, x.recheck])).toEqual([
      ["A", true],
      ["B", true],
      ["Pricing", false],
    ]);
  });

  it("changes nothing when there are no gaps", () => {
    expect(enforceRechecks([q("Pricing"), q("Users")], [], 2)).toEqual({ questions: [q("Pricing"), q("Users")], added: [] });
  });
});
