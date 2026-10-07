-- Spark anchored to the real project (roadmap 2.5.4): every learning path says which need it serves.
--   activity  a course activity (overdue, sent back for changes, or this week's)
--   project   the student's project problem
--   stage     the current programme step (Explore, Choose, Build, Present)
--   interest  the student's own curiosity: only for a student who isn't in a group
-- Code picks the options and validates the choice (apps/web/src/lib/bloom/anchor.ts); the database
-- refuses a path without one. The label is a snapshot of what the path served when it was started,
-- so it still reads right after the activity is renamed or the project problem changes.

alter table public.bloom_paths
  add column anchor_kind text,
  add column anchor_activity_id uuid references public.activities (id) on delete set null,
  add column anchor_label text not null default '' check (char_length(anchor_label) <= 200),
  add column anchor_week int check (anchor_week >= 1);

-- Paths started before anchors: the programme step they were started in, else the student's interest.
update public.bloom_paths p
set anchor_label = coalesce(
  (select s.name ->> 'en'
   from public.cohorts c
   join public.stages s on s.program_id = c.program_id and s.key = p.stage_key
   where c.id = p.cohort_id),
  '');
update public.bloom_paths set anchor_kind = case when anchor_label <> '' then 'stage' else 'interest' end;

alter table public.bloom_paths
  alter column anchor_kind set not null,
  add constraint bloom_paths_anchor_kind check (anchor_kind in ('activity', 'project', 'stage', 'interest')),
  add constraint bloom_paths_anchor_named check (anchor_kind = 'interest' or anchor_label <> ''),
  -- The activity may be deleted later (set null); the kind and label keep what the path served.
  add constraint bloom_paths_anchor_activity check (anchor_kind = 'activity' or anchor_activity_id is null);

create index bloom_paths_anchor_activity_idx on public.bloom_paths (anchor_activity_id) where anchor_activity_id is not null;

-- A new path's anchor must belong to the student's own course: an activity of their group's
-- programme, their own project in that group, or a step of that programme. A student in a group
-- can't fall back to "interest", even by leaving the group out. Anchors are fixed once the path
-- exists (they are not in the update grant).
create function public.bloom_paths_check_anchor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.anchor_kind is null then
    return new; -- the not-null constraint reports it
  end if;

  if new.anchor_kind = 'interest' and (new.cohort_id is not null or exists (
    select 1 from public.memberships where user_id = new.student_id and role = 'student'
  )) then
    raise exception 'A path in a group serves a course activity, the project or the programme step'
      using errcode = '23514';
  end if;

  if new.anchor_kind in ('activity', 'project', 'stage') and new.cohort_id is null then
    raise exception 'Only a student in a group can anchor a path to the course'
      using errcode = '23514';
  end if;

  if new.anchor_kind = 'activity' and not exists (
    select 1
    from public.activities a
    join public.stages s on s.id = a.stage_id
    join public.cohorts c on c.program_id = s.program_id
    where a.id = new.anchor_activity_id and c.id = new.cohort_id
  ) then
    raise exception 'The anchor activity is not part of this group''s programme'
      using errcode = '23514';
  end if;

  if new.anchor_kind = 'project' and not exists (
    select 1 from public.projects where student_id = new.student_id and cohort_id = new.cohort_id
  ) then
    raise exception 'The student has no project in this group'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke execute on function public.bloom_paths_check_anchor() from public, anon, authenticated;

create trigger bloom_paths_check_anchor before insert on public.bloom_paths
  for each row execute function public.bloom_paths_check_anchor();

-- create_bloom_path gains p_anchor: { "kind", "label", "activity_id", "week" }. Required, so the old
-- signature is dropped rather than overloaded (an overload would still create unanchored paths).
drop function public.create_bloom_path(text, text, text, text, boolean, jsonb, uuid, text);

create function public.create_bloom_path(
  p_title text,
  p_goal text,
  p_depth text,
  p_summary text,
  p_ai_generated boolean,
  p_tasks jsonb,
  p_cohort uuid default null,
  p_stage_key text default null,
  p_anchor jsonb default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_path uuid;
begin
  insert into public.bloom_paths (student_id, cohort_id, title, goal, depth, stage_key, summary, ai_generated,
                                  anchor_kind, anchor_activity_id, anchor_label, anchor_week)
  values (auth.uid(), p_cohort, p_title, coalesce(p_goal, ''), coalesce(p_depth, 'standard'), p_stage_key,
          coalesce(p_summary, ''), coalesce(p_ai_generated, false),
          p_anchor ->> 'kind', (p_anchor ->> 'activity_id')::uuid, left(coalesce(p_anchor ->> 'label', ''), 200),
          (p_anchor ->> 'week')::int)
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

revoke execute on function public.create_bloom_path(text, text, text, text, boolean, jsonb, uuid, text, jsonb) from public, anon;
grant execute on function public.create_bloom_path(text, text, text, text, boolean, jsonb, uuid, text, jsonb) to authenticated;
