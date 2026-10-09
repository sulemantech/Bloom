-- Feature switches for admins (MVP). Switches stay in feature_flags (global row, or one per group,
-- the group's row winning); the list of features and their defaults lives in the app
-- (apps/web/src/lib/features.ts). This migration only adds what the admin screen needs:
--   1. Every switch change is recorded in the audit log (who, when, which switch).
--   2. The "ai" master switch can pause all AI calls; a paused call is logged as outcome "paused".

create trigger feature_flags_audit after insert or update or delete on public.feature_flags
  for each row execute function public.write_audit_log();

alter table public.ai_runs drop constraint ai_runs_outcome_check;
alter table public.ai_runs add constraint ai_runs_outcome_check
  check (outcome in ('ok', 'refused', 'rate_limited', 'failed', 'limited', 'no_consent', 'paused'));
