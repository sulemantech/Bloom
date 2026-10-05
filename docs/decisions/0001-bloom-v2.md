# 0001: Bloom v2 defaults

- **Status:** Proposed, awaiting sign-off
- **Date:** 5 October 2026
- **Context:** [Bloom v2 blueprint](../bloom-coach-blueprint.html) and [roadmap](../bloom-v2-roadmap.html), task 0.1

The blueprint leaves a few questions open. This record settles each with a default so the build can
continue. A decision can be changed later by a new record that supersedes this one.

## Decisions

### 1. Parents keep full visibility of Ask Bloom

Parents can read every Ask Bloom question and answer, as today. Safety-flagged threads also go to the
mentor and admin first, following the safeguarding policy. Students are told plainly, next to the Ask
box, that their parent can read it.

**Why:** the current `bloom_ai` consent text promises parents can "read every question and answer".
Narrowing that (topics only) would need new consent wording and re-consent from every family. We can
revisit when consent v2 is written (task 3.1).

**Owner:** _(safeguarding lead)_

### 2. Photos are allowed, with guidance, and location data is removed

Students may upload photos of their own drawings, notes and prototypes. The upload screen asks them
not to photograph faces of other people, documents or addresses. Location (EXIF) data is stripped on
the server before storage; files are private and shared only through short-lived signed links.

**Why:** much of the real work (sketches, business maps, interview notes) happens on paper. Stripping
location on the server protects children even if the guidance is ignored.

**Owner:** _(safeguarding lead)_

### 3. English only for the MVP

All Bloom v2 interface text, prompts, rubrics and evals are in English. The text stays in
`messages/en.json` so other languages can be added later.

**Why:** the course runs in English, and every language multiplies rubric and eval work.

**Owner:** _(product lead)_

### 4. Course activities stay separate from Bloom

Programme activities and submissions (`activities`, `submissions`) are unchanged. Bloom v2 builds its
own activities and submissions. The two meet only in the project record (artifacts), later (P2).

**Why:** the course is live and mentor-led; changing it at the same time as Bloom doubles the risk.

**Owner:** _(product lead)_

### 5. The model is chosen per AI capability

The AI gateway picks the model for each capability (planner, coach, assessor, memory proposer,
progress card), so a cheaper or faster model can serve simple tasks. Today every capability uses the
same model; each choice will be backed by the capability's eval before it changes.

**Why:** cost and speed differ a lot between tasks, and `ai_runs` lets us measure both per capability.

**Owner:** _(product lead)_

### 6. Legacy tutor folders: remove from this branch (recommended)

`backend/`, `frontend/`, `skills/`, `example/` and the `Makefile` belong to the original Bloom tutor.
They are preserved on the `bloom/legacy` branch (local and `origin`). Recommendation: remove them from
the main line in one commit once this record is signed off, keeping `docs/legacy-tutor-architecture.md`
as the pointer.

**Why:** they are not part of the app, and they confuse new contributors and code search.

**Owner:** _(tech lead)_

## Sign-off

| Role | Name | Date |
|---|---|---|
| Product lead | | |
| Safeguarding lead | | |
| Tech lead | | |
