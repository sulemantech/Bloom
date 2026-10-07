-- Spark deterministic difficulty (personalisation roadmap, task 2.5.3).
-- The difficulty code decided for a step Spark wrote (lib/bloom/learner preferredDifficulty), kept so
-- the student, mentor and we can always see what was applied and why, even after the learner state
-- moves on. Null for steps written before this, by the student, or at planning time.

alter table public.bloom_tasks
  add column difficulty text check (difficulty in ('easier', 'same', 'harder'));

grant update (difficulty) on public.bloom_tasks to authenticated;
