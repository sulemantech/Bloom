-- Spark adaptive steps (personalisation roadmap, phase 1).
-- A planned path starts as an outline: only the first step is written in full. Each later step is
-- written when the student reaches it, from how the last one went (feeling, note, questions).
--   feeling       how the student found a step they finished; steers the difficulty of the next one
--   planned_only  an outline step (title and aim only) that Spark has not written yet

create type public.bloom_task_feeling as enum ('too_easy', 'just_right', 'too_hard');

alter table public.bloom_tasks
  add column feeling public.bloom_task_feeling,
  add column planned_only boolean not null default false;

grant update (feeling, planned_only) on public.bloom_tasks to authenticated;

-- Same as before, plus "planned_only" on each step.
-- p_tasks: [{ "kind": "learn" | "do" | "reflect", "title": "…", "details": "…", "planned_only": bool }, …]
create or replace function public.create_bloom_path(
  p_title text,
  p_goal text,
  p_depth text,
  p_summary text,
  p_ai_generated boolean,
  p_tasks jsonb,
  p_cohort uuid default null,
  p_stage_key text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_path uuid;
begin
  insert into public.bloom_paths (student_id, cohort_id, title, goal, depth, stage_key, summary, ai_generated)
  values (auth.uid(), p_cohort, p_title, coalesce(p_goal, ''), coalesce(p_depth, 'standard'), p_stage_key,
          coalesce(p_summary, ''), coalesce(p_ai_generated, false))
  returning id into v_path;

  insert into public.bloom_tasks (path_id, student_id, position, kind, title, details, planned_only)
  select v_path, auth.uid(), t.ord::int, (t.item ->> 'kind')::public.bloom_task_kind,
         t.item ->> 'title', coalesce(t.item ->> 'details', ''),
         coalesce((t.item ->> 'planned_only')::boolean, false)
  from jsonb_array_elements(coalesce(p_tasks, '[]'::jsonb)) with ordinality as t(item, ord);

  return v_path;
end;
$$;
