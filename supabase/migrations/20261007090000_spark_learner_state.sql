-- Spark learner state (personalisation roadmap, task 2.5.1).
-- What Spark knows about a student's learning, one row per idea ("concept"): whether they understand
-- it or are struggling with it, with the evidence behind that. Rows are written by the app's code from
-- Spark's reviews of check answers (the AI names the idea a question tests; code decides the status),
-- so the same evidence always gives the same state. Difficulty, project and next need are derived on
-- read, not stored.

create type public.spark_concept_status as enum ('struggling', 'understood');

create table public.spark_concepts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  key text not null check (char_length(key) between 1 and 80),      -- normalised label, for matching
  label text not null check (char_length(label) between 1 and 80),  -- as shown to people
  status public.spark_concept_status not null,
  struggle_count int not null default 0 check (struggle_count >= 0),
  nailed_count int not null default 0 check (nailed_count >= 0),
  last_path_id uuid references public.bloom_paths (id) on delete set null,
  last_task_id uuid references public.bloom_tasks (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, key)
);

create index spark_concepts_student_idx on public.spark_concepts (student_id, status, updated_at desc);

create trigger spark_concepts_updated_at before update on public.spark_concepts
  for each row execute function public.set_updated_at();
create trigger spark_concepts_audit after insert or update or delete on public.spark_concepts
  for each row execute function public.write_audit_log();

-- Same visibility as the rest of Spark: the student owns it; parents, mentors and admins can read it.
alter table public.spark_concepts enable row level security;

create policy "read spark concepts" on public.spark_concepts
  for select to authenticated using (public.can_view_student(student_id));
create policy "students record own concepts" on public.spark_concepts
  for insert to authenticated with check (student_id = auth.uid() and public.is_student());
create policy "students update own concepts" on public.spark_concepts
  for update to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "admins manage spark concepts" on public.spark_concepts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Data export now includes the learner state.
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
    'bloom_questions', (select coalesce(jsonb_agg(to_jsonb(bq)), '[]') from public.bloom_questions bq where bq.student_id = p_student),
    'spark_concepts', (select coalesce(jsonb_agg(to_jsonb(sc)), '[]') from public.spark_concepts sc where sc.student_id = p_student)
  );
end;
$$;
