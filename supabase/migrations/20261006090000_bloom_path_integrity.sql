-- Bloom path integrity (roadmap task 0.4).
-- 1. A path and its planned steps are created in one transaction, so a failed step insert can't
--    leave an empty path behind.
-- 2. A path's status follows its steps everywhere: all steps done → completed, otherwise active.
--    Archived stays archived until the student restores it. Previously only "Mark done" updated
--    the status, so adding a step to a finished path, or restoring one, left it wrong.

-- What a path's status should be from its steps (ignores "archived", which is the student's choice).
create function public.bloom_path_derived_status(p_path uuid)
returns public.bloom_path_status
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.bloom_tasks where path_id = p_path)
     and not exists (select 1 from public.bloom_tasks where path_id = p_path and status <> 'done')
    then 'completed'::public.bloom_path_status
    else 'active'::public.bloom_path_status
  end;
$$;

revoke execute on function public.bloom_path_derived_status(uuid) from public, anon, authenticated;

-- Any status the path is given other than "archived" is replaced by the derived one, so a restored
-- path comes back as completed when all its steps are done, and nobody can mark an unfinished
-- path completed. Named to sort before bloom_paths_completion, which stamps completed_at.
create function public.bloom_paths_auto_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'archived' then
    new.status = public.bloom_path_derived_status(new.id);
  end if;
  return new;
end;
$$;

create trigger bloom_paths_auto_status before update of status on public.bloom_paths
  for each row execute function public.bloom_paths_auto_status();

-- Adding, finishing, reopening or removing a step updates its path.
create function public.bloom_tasks_sync_path()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path uuid := case when tg_op = 'DELETE' then old.path_id else new.path_id end;
  v_status public.bloom_path_status := public.bloom_path_derived_status(v_path);
begin
  update public.bloom_paths
  set status = v_status
  where id = v_path and status <> 'archived' and status is distinct from v_status;
  return null;
end;
$$;

create trigger bloom_tasks_sync_path after insert or delete or update of status on public.bloom_tasks
  for each row execute function public.bloom_tasks_sync_path();

-- A path with its planned steps, all or nothing. Runs as the caller, so the usual row-level
-- security applies: only a student can create, and only for themselves.
-- p_tasks: [{ "kind": "learn" | "do" | "reflect", "title": "…", "details": "…" }, …] in order.
create function public.create_bloom_path(
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

  insert into public.bloom_tasks (path_id, student_id, position, kind, title, details)
  select v_path, auth.uid(), t.ord::int, (t.item ->> 'kind')::public.bloom_task_kind,
         t.item ->> 'title', coalesce(t.item ->> 'details', '')
  from jsonb_array_elements(coalesce(p_tasks, '[]'::jsonb)) with ordinality as t(item, ord);

  return v_path;
end;
$$;

revoke execute on function public.create_bloom_path(text, text, text, text, boolean, jsonb, uuid, text) from public, anon;
grant execute on function public.create_bloom_path(text, text, text, text, boolean, jsonb, uuid, text) to authenticated;
