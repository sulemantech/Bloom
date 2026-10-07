import { describe, expect, it } from "vitest";
import { adaptationReasons, asDifficulty } from "./reasons";

const questions = [
  { kind: "apply", question: "Q1", idea: "Leading questions" },
  { kind: "judge", question: "Q2", idea: "Fair questions" },
];

describe("adaptationReasons", () => {
  it("explains a step from the source feeling, weak answers, re-checks and difficulty", () => {
    const source = {
      feeling: "too_hard" as const,
      check_questions: questions,
      check_answers: ["A good try", "idk"],
      check_review: [{ verdict: "nearly" }, { verdict: "not_yet" }],
    };
    const target = { difficulty: "easier", check_questions: [{ question: "Again", idea: "Fair questions", recheck: true }, { question: "New", idea: "Patterns" }] };
    expect(adaptationReasons(source, 1, target)).toEqual([
      { kind: "feeling", step: 1, feeling: "too_hard" },
      { kind: "answer", step: 1, question: 1, verdict: "nearly" },
      { kind: "answer", step: 1, question: 2, verdict: "not_yet" },
      { kind: "recheck", idea: "Fair questions" },
      { kind: "difficulty", level: "easier" },
    ]);
  });

  it("says when every answered question was nailed; blanks give no reason", () => {
    const source = { feeling: null, check_questions: questions, check_answers: ["Yes", ""], check_review: [{ verdict: "nailed" }, { verdict: "not_yet" }] };
    expect(adaptationReasons(source, 2, { difficulty: "harder", check_questions: [] })).toEqual([
      { kind: "allNailed", step: 2 },
      { kind: "difficulty", level: "harder" },
    ]);
  });

  it("leaves out the difficulty when it is the same, and gives nothing without evidence", () => {
    expect(adaptationReasons(null, 0, { difficulty: "same", check_questions: [] })).toEqual([]);
    expect(adaptationReasons(null, 0, { difficulty: null, check_questions: [] })).toEqual([]);
  });

  it("gives no answer reasons before Spark has reviewed the answers", () => {
    const source = { feeling: "just_right" as const, check_questions: questions, check_answers: ["a", "b"], check_review: null };
    expect(adaptationReasons(source, 1, { difficulty: null, check_questions: [] })).toEqual([{ kind: "feeling", step: 1, feeling: "just_right" }]);
  });
});

describe("asDifficulty", () => {
  it("accepts only known levels", () => {
    expect(asDifficulty("easier")).toBe("easier");
    expect(asDifficulty("extreme")).toBeNull();
    expect(asDifficulty(null)).toBeNull();
  });
});
