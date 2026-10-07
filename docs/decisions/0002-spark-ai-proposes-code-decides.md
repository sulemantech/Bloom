# 0002: Spark — the AI proposes, code decides

- **Status:** Accepted
- **Date:** 7 October 2026
- **Context:** [Spark personalisation roadmap](../spark-personalisation-roadmap.md), phase 2.5 "Tighten the loop"

Spark adapts a student's learning with a language model. Models are good at writing (a step, a
question, feedback) and unreliable at keeping rules (always re-check a weak idea, apply the same
difficulty for the same evidence, never mark a question as something it isn't). Children, parents
and mentors need the rules to hold every time, and we need to explain any decision afterwards.

## Decision

Split every Spark decision into what the model **proposes** and what code **decides**.

| The AI proposes | Code decides |
|---|---|
| Step content, examples, tone | Which step is written next, and when (`nextStepToWrite`) |
| The idea each check question tests | What the student understands or struggles with (`applyReview`) |
| A draft verdict on each answer | Which gaps are open and which must be re-checked (`gapsToRecheck`) |
| Re-check questions | That every required re-check is present; adds a template one if not (`enforceRechecks`) |
| A sentence explaining a change | How hard the next step is (`preferredDifficulty`) |
| Which offered need a suggested path serves | Which needs are offered, in what order, and that the chosen one is valid (`anchorOptions`, `pickAnchor`, database trigger) |
| Wording of a progress card for parents | Who may need a mentor's nudge, and why (`nudgeReasons`) |
|  | Permissions, consent and limits (RLS, AI gateway) |

Rules live in pure modules (`apps/web/src/lib/bloom/*.ts`) with unit tests. The model is told the
rules so it usually follows them; code checks its output and corrects it when it doesn't
(**validate, then fall back**), so a rule never depends on the model getting it right.

## The learning loop (2.5.1–2.5.2)

**Teach → Check → Detect gap → Adapt next step → Re-check**

1. Each written step ends with check questions (2 for Quick, 3 otherwise), each naming its idea.
2. Spark drafts a verdict per answer. A blank answer is no evidence.
3. A "nearly" or "not yet" opens a gap; a "nailed" closes it. Status follows the latest evidence.
4. The next step re-checks up to *questions − 1* gaps, so it still checks its own new idea:
   this review's gaps first (not yet before nearly), then the path's older gaps, most missed first.
   Gaps over the cap wait for a later step.
5. The re-check runs in the same model call as writing the step (one call, ~10 s); because the
   review is only known after the call, code enforces the re-checks on the result.
6. A new path has no gaps of its own: the planner never marks re-checks.

## Difficulty and reasons (2.5.3)

7. Code decides each written step's difficulty (easier / same / harder) from the last three finished
   steps: feelings, plus marks already known. The step just finished counts through its feeling; its
   marks arrive with Spark's answer and act through re-checks (5). The planner's first step uses
   the same rule. The level is stored on the step (`bloom_tasks.difficulty`).
8. Spark is told the level as an instruction with measurable meanings (new ideas, actions, minutes).
   A model can't be forced to make something "harder", so compliance is **measured**, not assumed:
   one log line per written step, `spark.step_written` {difficulty, actions, minutes, rechecks,
   rechecksAddedByRule}.
9. Every adapted step shows reasons built by code from stored data (`lib/bloom/reasons.ts`), next to
   Spark's sentence: the feeling and weak answers it responds to, the gaps it re-checks and the level.

## Anchored to the real project (2.5.4)

10. Every path serves one need: a course activity, the project problem, the current programme step,
    or (only for a student without a group) their own interest. Code lists the options, most pressing
    first: work sent back for changes, overdue work, this week's work (at most 3), the project, the step.
11. Spark proposes which option each suggestion serves, constrained by an enum in the output schema;
    the server accepts only a key that is still an option (`pickAnchor`), else the most pressing need.
12. The database refuses a path without an anchor, an activity from another programme, a project the
    student doesn't have, or "interest" for a student in a group. The anchor is fixed after creation and
    its label is a snapshot, so the path still says what it served after the course changes.
13. Spark is told what the path is for when planning and when writing each later step, with the
    activity's instructions and whether it is late *now*.

## Mentors in the loop (2.5.5)

14. Code flags a student as "may need a nudge" by fixed rules (`NUDGE_RULES`): 2+ open gaps, 2+ overdue
    activities, or 7 days without activity. Every flag shows its reasons and the ideas named, and the
    list is ordered by rule (`byNudgePriority`). The AI never flags a student; a person decides what to do.
15. Open gaps are ordered by one rule (`openGaps`: most missed, then most recent), shared by the learner
    state, Spark's next need and the mentor views, so they always agree.
16. Progress-card drafts for parents get idea names only (understood, still practising), never answers,
    marks or counts, and may mention at most one idea being practised, framed as practice.

## Consequences

- Behaviour is predictable and testable: the same evidence always gives the same state.
- Every intervention can be explained ("re-checking *fair questions* because it was *not yet* on
  step 1"), which task 2.5.3 shows to students.
- Template re-check questions are plainer than the model's. They are a safety net; how often they
  are needed is a quality signal to watch (`rechecksAddedByRule` in the `spark.step_written` log).
- New Spark features must name which parts the model proposes and which code decides, before they
  are built.
