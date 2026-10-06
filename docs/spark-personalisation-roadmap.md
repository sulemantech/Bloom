# Spark personalised learning roadmap

- **Status:** Phase 1 done (6 October 2026). Phase 2 next; phases 3–7 not started.
- **Date:** 6 October 2026
- **Source:** the original Bloom tutor, kept on the `bloom/legacy` branch (`backend/app/courses.py`,
  `backend/app/recommendations.py`, `skills/`). File references below point there.

Spark today personalises the **start** of a learning path: the AI knows the student's age group,
programme step, project and earlier paths when it suggests and plans. Nothing the student does
afterwards changes what comes next. The original Bloom was built around that loop: every lesson was
written after the student finished the last one, from what they said, asked and answered.

This roadmap brings the original Bloom's personalised learning into Spark, adapted for students aged
12–18 and for the mentor and parent views. Phases are ordered by how much they strengthen
personalisation. Each new behaviour ships behind the `bloom_v2` flag (per group) first.

Where a phase overlaps the [Bloom v2 roadmap](bloom-v2-roadmap.html), the overlap is named so the
two are built once.

## Phase 1: Adaptive steps

The core of personalisation. Steps are written one at a time from how the last one went.

| # | Task | From the original Bloom | Status |
|---|---|---|---|
| 1.1 | **Outline first, write as you go.** Planning returns an outline of all steps; only the first is written in full. The rest are saved as outline steps (`planned_only`) and shown as "Spark will write this when you get here". | `create_course` (syllabus + first lesson only), `POST /courses/{id}/next` | ✅ Done |
| 1.2 | **How did it go?** Finishing a step asks: too easy / just right / too hard (`bloom_tasks.feeling`), plus "What was confusing, or where do you want to go next?" (the existing reflection). | `feedbacks.content` | ✅ Done |
| 1.3 | **Write the next step from that.** When a step is marked done, Spark writes the next outline step using the outline, the last steps, the reflection, the feeling and any questions asked on that step. A "Write this step" button retries if the AI was unavailable. | `NEXT_LESSON_PROMPT` | ✅ Done |
| 1.4 | **Difficulty adapts.** Too hard or confused → simpler, smaller, more groundwork. Too easy → more challenge. The step opens with one line saying what changed and why. | `NEXT_LESSON_PROMPT` rule 6 | ✅ Done |
| 1.5 | **Depth changes the teaching**, not only the step count: quick = core idea only; standard = adds common mistakes; deep = why it works, edge cases, counter-examples. | `LEARNING_DEPTH_PROFILES` | ✅ Done |
| 1.6 | **Teaching rules in every step:** an everyday analogy for each abstract idea, why before what, at most 1–2 new ideas per step. | `FIRST_LESSON_PROMPT`, `NEXT_LESSON_PROMPT` rules 5–8 | ✅ Done |
| 1.7 | **Mentors and parents see the feeling** next to each step's reflection. | — | ✅ Done |
| 1.8 | **Consent wording.** The "Spark AI guide" consent says only age group, step and project are shared. Update it to say the student's notes and questions on a path are also used to write their next steps. | — | ✅ Done (re-consent for existing families not decided) |
| 1.9 | **Database tests.** pgTAP tests for the new `feeling` and `planned_only` columns and `create_bloom_path`. | — | ✅ Done (13 tests in `supabase/tests/rls.test.sql`; 106/106 pass) |
| 1.10 | **Live test.** Apply the migration (`npm run db:push`, then `npm run db:types`), turn on `bloom_v2` for a group and check the "Done when" below with real AI calls. | — | ✅ Done: a "too hard" step was followed by a smaller, re-explained step that named the confusion |
| 1.11 | **Make the loop visible.** "Step 3 of 5" with a step tracker; the current step highlighted as "Now"; done and upcoming steps folded; each step shows the student's feedback and "Spark used this to write step N"; the step Spark wrote opens with "Spark changed this step for you, because on step N you said…" (`bloom_tasks.adaptation`, `adapted_from`). Instructions shown as numbered actions and labelled notes. | — | ✅ Done |

**Done when:** in a `bloom_v2` group, a student finishes step 1 saying "too hard" and the confusing
part, and step 2 is written simpler and addresses it; paths in other groups behave as before.

**Built in:** `supabase/migrations/20261006120000_spark_adaptive_steps.sql`, `apps/web/src/lib/bloom/adaptive.ts`
(with tests), `apps/web/src/lib/ai/bloom.ts` (`planBloomPath` outline mode, `writeBloomStep`), and the
Spark actions, forms and path page. The new AI call is logged as `bloom_step` and shares the daily limit.

## Phase 2: Check your understanding

| # | Task | From the original Bloom |
|---|---|---|
| 2.1 | Each written step can end with 2–3 thinking questions: at least one applying the idea to a new situation, one comparing or judging. | "Thinking questions" in `FIRST_LESSON_PROMPT` |
| 2.2 | The student answers them when finishing the step. | `feedbacks.thought_answers` |
| 2.3 | The next step opens with a short review of each answer ("Nailed it" / "Nearly" / "Not yet") and the right answer explained. | "Review of last time's questions" in `NEXT_LESSON_PROMPT` |

Overlaps Bloom v2 **Assessments** and **Rubrics**: build the review on the same assessor.

## Phase 3: Mastery

| # | Task | From the original Bloom |
|---|---|---|
| 3.1 | A path has a skill list ("Able to explain…", "Able to use…") grouped in modules, plus "not covered here". | `SYLLABUS_PROMPT` |
| 3.2 | Each written step names the skills it covers; skills are ticked when the step is done. | `<!-- mastery: -->`, `_auto_check_mastery` |
| 3.3 | Progress shows skills covered, and Spark keeps adding steps until every skill is covered instead of stopping at a fixed count. | `_mastery_progress`, `generate_next_lesson` |
| 3.4 | A final review step, then an end summary: concept map, skill-by-skill review, key insights, where to go next. | `EVAL_LESSON_PROMPT`, `SUMMARY_PROMPT` |

Needs a schema change: do it with the Bloom v2 **Expand migration** (1.1) so legacy paths keep working.

## Phase 4: Ask while learning

| # | Task | From the original Bloom |
|---|---|---|
| 4.1 | Select text in a step and ask about it. | `annotations` (`original_text`, `position_*`) |
| 4.2 | Follow-up questions in the same thread, with the step as context. | `annotations.messages`, `add_annotation_message` |
| 4.3 | The next step answers anything still unclear from these threads. | "Your highlighted questions answered" in `NEXT_LESSON_PROMPT` |

Overlaps Bloom v2 **Threads**: one thread model for both.

## Phase 5: Recommendations from learning history

| # | Task | From the original Bloom |
|---|---|---|
| 5.1 | Suggestions use skills mastered and questions asked, not only path titles. | `_build_learning_profile` |
| 5.2 | Three kinds every time: fill a gap in the basics, connect two topics, stretch further. Each says how it builds on what the student learned. | `RECOMMENDATION_PROMPT` (`rationale`, `bridge`, `source_topics`) |
| 5.3 | A saved to-learn list; dismissed ideas are not suggested again. | `learning_recommendations` (`suggested / saved / started / dismissed`) |

Overlaps Bloom v2 **Facts table** and **Memory proposer**.

## Phase 6: Learning modes

The six method skills, rewritten in English for ages 12–18 and offered as a mode on a path or a step.

| Mode | What it does | Source |
|---|---|---|
| Explain it back | Student explains in their own words; Spark finds the gaps | `skills/learn-feynman` |
| Map it | Build a map of a new field before diving in | `skills/learn-graph` |
| Borrow an idea | Learn through analogies from other fields | `skills/learn-crossover` |
| Five angles | One concept from five perspectives | `skills/learn-deep` |
| Is it worth it? | Decide what to learn and how far | `skills/learn-occam` |
| Make and improve | Build a first version, then improve it in rounds | `skills/learn-prototype` |

## Phase 7: Learn from your own materials

| # | Task | From the original Bloom |
|---|---|---|
| 7.1 | Upload a PDF, notes or code; Spark builds the path and steps from that material. | `create_course_from_source`, `SOURCE_LESSON_PROMPT` |
| 7.2 | Read the file in Spark and ask about any part of it. | `PdfViewer`, `pdf_position` |
| 7.3 | Project reading: each file becomes a step to ask about. | `create_course_from_project` |

Builds on Bloom v2 **Evidence storage**, **PII check** and **Consent v2**.
