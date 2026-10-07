-- Spark deterministic difficulty, at planning time too (roadmap 2.5.3): the first step of a planned
-- path is written now, so it records the difficulty code decided for it, like later steps.
-- Same as before, plus "difficulty" on each step.
-- p_tasks: [{ "kind", "title", "details", "planned_only", "check_questions", "difficulty" }, …]
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

  insert into public.bloom_tasks (path_id, student_id, position, kind, title, details, planned_only, check_questions, difficulty)
  select v_path, auth.uid(), t.ord::int, (t.item ->> 'kind')::public.bloom_task_kind,
         t.item ->> 'title', coalesce(t.item ->> 'details', ''),
         coalesce((t.item ->> 'planned_only')::boolean, false),
         coalesce(t.item -> 'check_questions', '[]'::jsonb),
         t.item ->> 'difficulty'
  from jsonb_array_elements(coalesce(p_tasks, '[]'::jsonb)) with ordinality as t(item, ord);

  return v_path;
end;
$$;
