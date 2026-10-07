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

## Consequences

- Behaviour is predictable and testable: the same evidence always gives the same state.
- Every intervention can be explained ("re-checking *fair questions* because it was *not yet* on
  step 1"), which task 2.5.3 shows to students.
- Template re-check questions are plainer than the model's. They are a safety net; how often they
  are needed is a quality signal to watch (logged as "Spark re-check added by rule").
- New Spark features must name which parts the model proposes and which code decides, before they
  are built.
