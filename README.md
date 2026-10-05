# Youth IdeaLab

The learning platform for [Youth Idea Lab](https://youth-idealab.vercel.app/): an 8-week, mentor-led course where students aged 12–18 explore, choose a real problem, build their answer to it and present it at Demo Day.

> The earlier Bloom AI-tutor code is preserved on the `bloom/legacy` branch. Its folders (`backend/`, `frontend/`, `skills/`, `example/`) are still in this branch for now but are not part of the app.

**Start here:** [docs/architecture.md](docs/architecture.md) maps the app, the database and how they fit together.

## Structure

```
apps/web/        Next.js app (student, parent, mentor and admin views)
  src/lib/       supabase/ clients · notify · ai · storage · flags · sentry
  messages/      interface text (next-intl), English for now
supabase/
  migrations/    tables, row-level security, audit log, storage policies
  seed.sql       the 8-week programme: 4 steps and activities per age group
  tests/         pgTAP tests of what each role can see and change
```

## Concepts

| Website term | In the database |
|---|---|
| The 8-week course | `programs` (template) |
| 4 steps: Explore, Choose, Build, Present | `stages` |
| Weekly tasks | `activities` (`age_group` null = both) |
| Explorer (12–14) / Builder (15–18) | `age_group` enum |
| A group of students | `cohorts` + `memberships` |
| Weekly progress card for parents | `progress_cards` (parents see `approved` only) |

## Development

Requires Node 20+. The database runs on Supabase (online); Docker is only needed for the test runner.

```bash
npm install                                  # Supabase CLI (repo root)
npx supabase login
npx supabase link --project-ref <project-ref>

npm run db:push                              # apply new migrations to the linked project
npm run db:test                              # row-level security tests (run in a rolled-back transaction)
npm run db:types                             # regenerate TypeScript types after schema changes

cd apps/web
npm install
cp .env.example .env.local                   # URL + keys from Project Settings → API Keys
npm run dev                                  # http://localhost:3000
```

To seed a fresh project: `npx supabase db push --include-seed`.
Once real families use the online project, develop against a second Supabase project or a local one
(`npm run db:local:start`, needs Docker) instead.

For deployment, set the same environment variables in Vercel.

To try the app with demo accounts for each role, see [docs/DEMO_ACCOUNTS.md](docs/DEMO_ACCOUNTS.md) (temporary).

## Licence

MIT. Includes code originally from [Bloom](https://github.com/Li-Evan/Bloom).
