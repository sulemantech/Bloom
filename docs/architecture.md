# Architecture

How the Youth Idea Lab app (`apps/web`) and its database (`supabase/`) fit together. One page; the
linked documents go deeper.

> The repo also still contains the original Bloom tutor (`backend/`, `frontend/`, `skills/`,
> `example/`, `Makefile`). It is legacy, not used by the app, and is preserved on the `bloom/legacy`
> branch. Its notes are in [legacy-tutor-architecture.md](legacy-tutor-architecture.md).

## The stack

| Part | What | Where |
|---|---|---|
| Web app | Next.js 16, React 19, server components and server actions, Tailwind | `apps/web/` |
| Database, auth, files | Supabase (Postgres with row-level security, Auth, Storage) | `supabase/` |
| AI | Anthropic API, only through the gateway | `apps/web/src/lib/ai/` |
| Interface text | next-intl, English for now | `apps/web/messages/en.json` |
| Tests | Vitest for pure logic, pgTAP for the database and permissions | `*.test.ts`, `supabase/tests/` |

## Map of `apps/web/src`

```
app/                  one folder per area; page.tsx renders, actions.ts changes data
  student/            home, activities, project, classes, spark/ (learning paths, Spark)
  parent/             children, consents, approved progress cards
  mentor/             groups, students, feedback, progress cards, Bloom notes
  admin/              people, groups, programme, payments, activity log
  login/ auth/        sign-in and Supabase auth callbacks
components/           AppShell, SideNav, ui/ primitives, bloom.tsx, course.tsx
lib/
  supabase/           server, browser and admin (secret key) clients; generated database.types.ts
  data/               read queries shared by pages (overview, cohort, bloom, admin)
  ai/                 gateway.ts (consent, daily limit, ai_runs log) + one file per AI capability
  auth.ts             current profile, requireRole
  flags.ts            feature flags per group (bloom_v2)
  programme.ts        course weeks and steps (pure, unit tested)
  storage.ts notify.ts sentry.ts env.ts
```

## Who enforces what

| Layer | Job |
|---|---|
| Server components (`page.tsx`) | Read data and render HTML on the server |
| Client components (`"use client"`) | Interaction in the browser |
| Server actions (`actions.ts`) | Validate input, apply business rules, call the AI gateway |
| `lib/` modules | Pure rules that are easy to unit test |
| Row-level security (migrations) | The last line of defence: who can read and write which rows |
| Triggers and security-definer functions | Rules that must hold whoever writes (path status, atomic path creation, mentor notes) |

Rule of thumb: the UI is for convenience, actions for business rules, the database for guarantees.

## Data model in one picture

```
organizations
└── programs (template: the 8-week course) → stages (Explore, Choose, Build, Present) → activities
└── cohorts (a real group) → memberships (student | mentor, age group), sessions
      per student: projects · submissions → feedback · progress_cards · bloom_paths → bloom_tasks
profiles.role: student | parent | mentor | admin    guardian_links: parent ↔ student
consents: per student (platform, ai, bloom_ai, media, public_portfolio)
ai_runs: one row per AI call (no text), admins only
```

## Changing things

- **Schema:** add a migration in `supabase/migrations/`, run `npm run db:local:test` (or
  `npm run db:test`), then `npm run db:types` and commit the regenerated types.
- **AI:** add a capability file in `lib/ai/` that calls `generateText` or `generateStructured`; never
  create an Anthropic client elsewhere.
- **New Bloom v2 features:** put them behind `bloomV2Enabled(studentId)` so they reach the pilot
  group first.

## Further reading

- [Bloom as built](bloom-as-built.html): what Bloom does today, and its known defects
- [Bloom v2 blueprint](bloom-coach-blueprint.html): the approved design
- [Bloom v2 roadmap](bloom-v2-roadmap.html): phases, tasks and acceptance criteria
- [Decisions](decisions/): recorded product and safeguarding decisions
- [Demo accounts](DEMO_ACCOUNTS.md), [UI language](ui-language.md)
