# Demo accounts (temporary)

> **Remove before real families join.** These accounts exist in the development Supabase project
> (`kogvxwwydrasbitdrtqs`) for trying the app.

| Role | Login | Lands on | Notes |
|---|---|---|---|
| Admin | `admin.demo@example.com` | `/admin` | Sees everything |
| Mentor | `mentor.demo@example.com` | `/mentor` | Mentor of Group 1 |
| Parent | `parent.demo@example.com` | `/parent` | Parent of `demo.student`, platform consent recorded |
| Student | username `demo.student` | `/student` | Group 1, Explorer (12–14) |

Passwords are in `apps/web/.env.local` (`DEMO_*_PASSWORD`), which is never committed.

## Signing in

- **Student:** login page → **Student** tab → username and password.
- **Parent, mentor, admin:** login page → **Parent or mentor** tab → the dashed
  "Development only" box → email and password. That box only appears when
  `ENABLE_DEV_PASSWORD_LOGIN=true` is set in `apps/web/.env.local`; in production, adults sign
  in with an email link.

`npm run seed:demo` (in `apps/web`) creates the accounts, or resets them to the passwords in
`.env.local`. It's safe to re-run.

## Removing them

1. Supabase dashboard → Authentication → Users: delete `admin.demo@example.com`,
   `mentor.demo@example.com`, `parent.demo@example.com` and
   `demo.student@students.youthidealab.invalid`. Their profiles, memberships, links and consents
   are deleted with them.
2. Delete this file and `apps/web/scripts/seed-demo.mjs`, remove the `seed:demo` script from
   `apps/web/package.json`, and remove the `DEMO_*` lines from `.env.local` and `.env.example`.
3. Remove the development password sign-in: `devPasswordSignIn` in
   `apps/web/src/app/login/actions.ts`, its form in `LoginForms.tsx`, and
   `ENABLE_DEV_PASSWORD_LOGIN` from the env files.
4. Delete `apps/web/scripts/login-link.mjs` and its `login-link` script.
