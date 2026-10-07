-- Spark "Check your understanding" (personalisation roadmap, phase 2).
-- Each step Spark writes ends with 2–3 short questions. The student may answer them when finishing
-- the step; when Spark writes the next step it also reviews the answers, so the next step adapts to
-- evidence, not only to how the step felt.
--   check_questions  [{ "kind": "apply" | "judge", "question": "…" }, …]
--   check_answers    ["…", "…"]  the student's answers, in question order ("" = left blank)
--   check_review     [{ "verdict": "nailed" | "nearly" | "not_yet", "feedback": "…", "key_idea": "…" }, …]

alter table public.bloom_tasks
  add column check_questions jsonb not null default '[]'
    check (jsonb_typeof(check_questions) = 'array' and jsonb_array_length(check_questions) <= 5),
  add column check_answers jsonb
    check (check_answers is null or (jsonb_typeof(check_answers) = 'array' and jsonb_array_length(check_answers) <= 5
                                     and length(check_answers::text) <= 6000)),
  add column check_review jsonb
    check (check_review is null or (jsonb_typeof(check_review) = 'array' and jsonb_array_length(check_review) <= 5));

grant update (check_questions, check_answers, check_review) on public.bloom_tasks to authenticated;

-- Same as before, plus "check_questions" on each step.
-- p_tasks: [{ "kind", "title", "details", "planned_only": bool, "check_questions": [...] }, …]
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

  insert into public.bloom_tasks (path_id, student_id, position, kind, title, details, planned_only, check_questions)
  select v_path, auth.uid(), t.ord::int, (t.item ->> 'kind')::public.bloom_task_kind,
         t.item ->> 'title', coalesce(t.item ->> 'details', ''),
         coalesce((t.item ->> 'planned_only')::boolean, false),
         coalesce(t.item -> 'check_questions', '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_tasks, '[]'::jsonb)) with ordinality as t(item, ord);

  return v_path;
end;
$$;
