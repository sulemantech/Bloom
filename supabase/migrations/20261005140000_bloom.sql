-- Bloom: each student's personal learning space. A student opens a learning path on anything
-- they want to understand (often suggested by AI from their project and programme step), works
-- through its tasks, writes reflections and asks Bloom questions. Mentors, parents and admins
-- see the same record through can_view_student(), so everyone follows the student's journey.

-- Separate permission for the student-facing AI guide (the existing "ai" consent only covers
-- mentors drafting progress cards).
alter type public.consent_type add value if not exists 'bloom_ai';

create type public.bloom_path_status as enum ('active', 'completed', 'archived');
create type public.bloom_task_status as enum ('todo', 'doing', 'done');
create type public.bloom_task_kind as enum ('learn', 'do', 'reflect');

create table public.bloom_paths (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  cohort_id uuid references public.cohorts (id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  goal text not null default '' check (char_length(goal) <= 1000),
  summary text not null default '',
  stage_key text,                              -- programme step when the path was started
  depth text not null default 'standard' check (depth in ('quick', 'standard', 'deep')),
  status public.bloom_path_status not null default 'active',
  ai_generated boolean not null default false,
  mentor_note text,
  mentor_note_by uuid references public.profiles (id) on delete set null,
  mentor_note_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bloom_paths_student_idx on public.bloom_paths (student_id, created_at desc);

create table public.bloom_tasks (
  id uuid primary key default gen_random_uuid(),
  path_id uuid not null references public.bloom_paths (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,  -- copied from the path
  position int not null default 0,
  kind public.bloom_task_kind not null default 'do',
  title text not null check (char_length(title) between 1 and 160),
  details text not null default '' check (char_length(details) <= 6000),
  status public.bloom_task_status not null default 'todo',
  reflection text check (char_length(reflection) <= 4000),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bloom_tasks_path_idx on public.bloom_tasks (path_id, position);
create index bloom_tasks_student_idx on public.bloom_tasks (student_id);

-- Questions a student asks Bloom, with the answer. Kept so mentors and parents can see them.
create table public.bloom_questions (
  id uuid primary key default gen_random_uuid(),
  path_id uuid not null references public.bloom_paths (id) on delete cascade,
  task_id uuid references public.bloom_tasks (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,  -- copied from the path
  question text not null check (char_length(question) between 1 and 1000),
  answer text not null default '',
  created_at timestamptz not null default now()
);

create index bloom_questions_path_idx on public.bloom_questions (path_id, created_at);

create trigger bloom_paths_updated_at before update on public.bloom_paths
  for each row execute function public.set_updated_at();
create trigger bloom_tasks_updated_at before update on public.bloom_tasks
  for each row execute function public.set_updated_at();

-- Tasks and questions always belong to their path's student (so RLS can't be sidestepped by
-- attaching rows to someone else's path).
create function public.bloom_copy_student()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select student_id into new.student_id from public.bloom_paths where id = new.path_id;
  if new.student_id is null then
    raise exception 'Learning path not found';
  end if;
  return new;
end;
$$;

create trigger bloom_tasks_student before insert or update of path_id on public.bloom_tasks
  for each row execute function public.bloom_copy_student();
create trigger bloom_questions_student before insert on public.bloom_questions
  for each row execute function public.bloom_copy_student();

-- Completion timestamps follow status.
create function public.bloom_stamp_completion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'bloom_tasks' then
    new.completed_at = case when new.status = 'done' then coalesce(old.completed_at, now()) else null end;
  else
    new.completed_at = case when new.status = 'completed' then coalesce(old.completed_at, now()) else null end;
  end if;
  return new;
end;
$$;

create trigger bloom_tasks_completion before insert or update of status on public.bloom_tasks
  for each row execute function public.bloom_stamp_completion();
create trigger bloom_paths_completion before insert or update of status on public.bloom_paths
  for each row execute function public.bloom_stamp_completion();

-- Audit log (ids and column names only, like the other tables)
create trigger bloom_paths_audit after insert or update or delete on public.bloom_paths
  for each row execute function public.write_audit_log();
create trigger bloom_tasks_audit after insert or update or delete on public.bloom_tasks
  for each row execute function public.write_audit_log();
create trigger bloom_questions_audit after insert or update or delete on public.bloom_questions
  for each row execute function public.write_audit_log();

-- ---------------------------------------------------------------------------
-- Row-level security: the student owns their Bloom; their parents, mentors and admins can read it.
-- ---------------------------------------------------------------------------
alter table public.bloom_paths enable row level security;
alter table public.bloom_tasks enable row level security;
alter table public.bloom_questions enable row level security;

create function public.is_student()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'student');
$$;

create policy "read bloom paths" on public.bloom_paths
  for select to authenticated using (public.can_view_student(student_id));
create policy "students create own paths" on public.bloom_paths
  for insert to authenticated with check (
    student_id = auth.uid() and public.is_student() and mentor_note is null
    and (cohort_id is null or public.is_cohort_member(cohort_id))
  );
create policy "students update own paths" on public.bloom_paths
  for update to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "students delete own paths" on public.bloom_paths
  for delete to authenticated using (student_id = auth.uid());
create policy "admins manage bloom paths" on public.bloom_paths
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke update on public.bloom_paths from authenticated;
grant update (title, goal, status) on public.bloom_paths to authenticated;

create policy "read bloom tasks" on public.bloom_tasks
  for select to authenticated using (public.can_view_student(student_id));
create policy "students add own tasks" on public.bloom_tasks
  for insert to authenticated with check (student_id = auth.uid());
create policy "students update own tasks" on public.bloom_tasks
  for update to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "students delete own tasks" on public.bloom_tasks
  for delete to authenticated using (student_id = auth.uid());
create policy "admins manage bloom tasks" on public.bloom_tasks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke update on public.bloom_tasks from authenticated;
grant update (title, details, status, reflection, position) on public.bloom_tasks to authenticated;

create policy "read bloom questions" on public.bloom_questions
  for select to authenticated using (public.can_view_student(student_id));
create policy "students ask questions" on public.bloom_questions
  for insert to authenticated with check (student_id = auth.uid());
create policy "admins manage bloom questions" on public.bloom_questions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke update on public.bloom_questions from authenticated;

-- Mentors (of the student) and admins leave a short note on a path; students can't write it.
create function public.set_bloom_mentor_note(p_path uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student uuid;
begin
  select student_id into v_student from public.bloom_paths where id = p_path;
  if v_student is null or not (public.mentors_student(v_student) or public.is_admin()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.bloom_paths
  set mentor_note = nullif(left(trim(p_note), 2000), ''),
      mentor_note_by = case when nullif(trim(p_note), '') is null then null else auth.uid() end,
      mentor_note_at = case when nullif(trim(p_note), '') is null then null else now() end
  where id = p_path;
end;
$$;

revoke execute on function public.set_bloom_mentor_note(uuid, text) from anon;

-- ---------------------------------------------------------------------------
-- Data export now includes Bloom.
-- ---------------------------------------------------------------------------
create or replace function public.export_student_data(p_student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.is_parent_of(p_student) or public.is_admin()) then
    raise exception 'Not allowed';
  end if;

  return jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = p_student),
    'guardians', (select coalesce(jsonb_agg(to_jsonb(g)), '[]') from public.guardian_links g where g.student_id = p_student),
    'consents', (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from public.consents c where c.student_id = p_student),
    'memberships', (select coalesce(jsonb_agg(to_jsonb(m)), '[]') from public.memberships m where m.user_id = p_student),
    'projects', (select coalesce(jsonb_agg(to_jsonb(pr)), '[]') from public.projects pr where pr.student_id = p_student),
    'submissions', (select coalesce(jsonb_agg(to_jsonb(s)), '[]') from public.submissions s where s.student_id = p_student),
    'submission_files', (select coalesce(jsonb_agg(to_jsonb(f)), '[]')
                         from public.submission_files f join public.submissions s on s.id = f.submission_id
                         where s.student_id = p_student),
    'feedback', (select coalesce(jsonb_agg(to_jsonb(fb)), '[]')
                 from public.feedback fb join public.submissions s on s.id = fb.submission_id
                 where s.student_id = p_student),
    'progress_cards', (select coalesce(jsonb_agg(to_jsonb(pc)), '[]')
                       from public.progress_cards pc where pc.student_id = p_student and pc.status = 'approved'),
    'bloom_paths', (select coalesce(jsonb_agg(to_jsonb(bp)), '[]') from public.bloom_paths bp where bp.student_id = p_student),
    'bloom_tasks', (select coalesce(jsonb_agg(to_jsonb(bt)), '[]') from public.bloom_tasks bt where bt.student_id = p_student),
    'bloom_questions', (select coalesce(jsonb_agg(to_jsonb(bq)), '[]') from public.bloom_questions bq where bq.student_id = p_student)
  );
end;
$$;
