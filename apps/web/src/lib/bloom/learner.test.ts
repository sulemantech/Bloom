import { describe, expect, it } from "vitest";
import { applyReview, conceptKey, learnerState, nextNeed, preferredDifficulty, type Concept } from "./learner";

const questions = [
  { kind: "apply", question: "Name a trigger", idea: "Habit triggers" },
  { kind: "judge", question: "Which loop is stronger?", idea: "Habit loop" },
  { kind: "apply", question: "Spot the reward", idea: "Rewards" },
];

describe("conceptKey", () => {
  it("matches the same idea written differently", () => {
    expect(conceptKey("  Habit-Triggers! ")).toBe(conceptKey("habit triggers"));
  });
});

describe("applyReview", () => {
  it("records understanding for nailed answers and struggles for nearly / not yet; blanks are no evidence", () => {
    const changed = applyReview([], {
      check_questions: questions,
      check_answers: ["A buzz", "The first", ""],
      check_review: [{ verdict: "nailed" }, { verdict: "not_yet" }, { verdict: "not_yet" }],
    });
    expect(changed).toEqual([
      { key: "habit triggers", label: "Habit triggers", status: "understood", struggle_count: 0, nailed_count: 1 },
      { key: "habit loop", label: "Habit loop", status: "struggling", struggle_count: 1, nailed_count: 0 },
    ]);
  });

  it("builds on existing evidence; the latest verdict sets the status", () => {
    const existing: Concept[] = [{ key: "habit loop", label: "Habit loop", status: "struggling", struggle_count: 2, nailed_count: 0 }];
    const changed = applyReview(existing, {
      check_questions: [questions[1]],
      check_answers: ["Trigger, action, reward"],
      check_review: [{ verdict: "nailed" }],
    });
    expect(changed).toEqual([{ key: "habit loop", label: "Habit loop", status: "understood", struggle_count: 2, nailed_count: 1 }]);
  });

  it("changes nothing before a review, or for questions without an idea", () => {
    expect(applyReview([], { check_questions: questions, check_answers: ["a", "b", "c"], check_review: null })).toEqual([]);
    expect(applyReview([], { check_questions: [{ question: "Why?" }], check_answers: ["Because"], check_review: [{ verdict: "nailed" }] })).toEqual([]);
  });
});

describe("preferredDifficulty", () => {
  it("is the same with no evidence", () => {
    expect(preferredDifficulty([])).toEqual({ level: "same", basedOn: 0 });
  });

  it("goes easier after hard steps and weak answers", () => {
    const steps = [
      { feeling: "too_hard" as const, check_answers: ["x", "y"], check_review: [{ verdict: "not_yet" }, { verdict: "nearly" }] },
      { feeling: "just_right" as const },
    ];
    expect(preferredDifficulty(steps).level).toBe("easier");
  });

  it("goes harder when steps feel easy and answers are nailed", () => {
    const steps = [
      { feeling: "too_easy" as const, check_answers: ["x"], check_review: [{ verdict: "nailed" }] },
      { feeling: "just_right" as const, check_answers: ["x"], check_review: [{ verdict: "nailed" }] },
    ];
    expect(preferredDifficulty(steps).level).toBe("harder");
  });

  it("only counts the last three steps", () => {
    const easy = { feeling: "too_easy" as const };
    const hard = { feeling: "too_hard" as const };
    expect(preferredDifficulty([easy, easy, easy, hard, hard, hard]).level).toBe("harder");
  });
});

describe("nextNeed and learnerState", () => {
  const concepts: Concept[] = [
    { key: "a", label: "Rewards", status: "struggling", struggle_count: 1, nailed_count: 0, updated_at: "2026-10-07T10:00:00Z" },
    { key: "b", label: "Habit loop", status: "struggling", struggle_count: 3, nailed_count: 0, updated_at: "2026-10-06T10:00:00Z" },
    { key: "c", label: "Habit triggers", status: "understood", struggle_count: 0, nailed_count: 2, updated_at: "2026-10-07T09:00:00Z" },
  ];
  const course = { title: "Talk to 3 people", week: 3, overdue: true };

  it("puts the most-struggled idea first, then course work", () => {
    expect(nextNeed(concepts, course)).toEqual({ kind: "practise", idea: "Habit loop" });
    expect(nextNeed(concepts.filter((c) => c.status === "understood"), course)).toEqual({ kind: "activity", ...course });
    expect(nextNeed([], null)).toBeNull();
  });

  it("summarises the state for people and for Spark", () => {
    expect(learnerState(concepts, [{ feeling: "too_hard" }], course)).toEqual({
      understands: ["Habit triggers"],
      strugglesWith: [
        { idea: "Habit loop", times: 3 },
        { idea: "Rewards", times: 1 },
      ],
      difficulty: "easier",
      nextNeed: { kind: "practise", idea: "Habit loop" },
    });
  });
});
