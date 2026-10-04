-- Youth IdeaLab foundation schema
-- Template (programs/stages/activities) vs instance (cohorts/memberships/...) split,
-- row-level security on every table, consent records and an audit log.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('student', 'parent', 'mentor', 'admin');
create type public.cohort_role as enum ('student', 'mentor');
create type public.age_group as enum ('explorer', 'builder');          -- 12–14 / 15–18
create type public.project_area as enum ('technology', 'design', 'business', 'social_impact', 'undecided');
create type public.project_status as enum ('exploring', 'chosen', 'building', 'presenting', 'done');
create type public.submission_type as enum ('text', 'file', 'link', 'text_and_file');
create type public.submission_status as enum ('submitted', 'needs_changes', 'done');
create type public.card_status as enum ('draft', 'approved');
create type public.consent_type as enum ('platform', 'public_portfolio', 'media', 'ai');

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Organizations and people
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id),
  role public.app_role not null default 'parent',
  full_name text not null default '',
  username text unique,                       -- students sign in with a username, not an email
  birth_year int check (birth_year between 1900 and 2100),
  country text,
  locale text not null default 'en',
  timezone text not null default 'Asia/Karachi',
  prefers_female_mentor boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile for every new auth user. The role comes from app_metadata, which only
-- the server (service role) can set; self sign-ups therefore always become parents.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role, full_name, username)
  values (
    new.id,
    coalesce((new.raw_app_meta_data ->> 'role')::public.app_role, 'parent'),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_app_meta_data ->> 'username'
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.guardian_links (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  relationship text,
  created_at timestamptz not null default now(),
  unique (parent_id, student_id)
);

-- One row per consent decision. Revoking sets revoked_at; a new version is a new row.
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  parent_id uuid not null references public.profiles (id) on delete cascade,
  type public.consent_type not null,
  version text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index consents_student_type_idx on public.consents (student_id, type);

-- ---------------------------------------------------------------------------
-- Programme template
-- Translatable content is stored as jsonb keyed by locale, e.g. {"en": "...", "ur": "..."}.
-- ---------------------------------------------------------------------------
create table public.programs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id),
  slug text not null unique,
  name jsonb not null,
  weeks int not null check (weeks > 0),
  created_at timestamptz not null default now()
);

create table public.stages (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  position int not null,
  key text not null,
  name jsonb not null,
  summary jsonb,
  week_from int not null,
  week_to int not null,
  check (week_from >= 1 and week_to >= week_from),
  unique (program_id, position),
  unique (program_id, key)
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.stages (id) on delete cascade,
  week int not null check (week >= 1),
  position int not null default 0,
  title jsonb not null,
  instructions jsonb not null,
  age_group public.age_group,                 -- null = both age groups
  submission_type public.submission_type not null default 'text',
  created_at timestamptz not null default now()
);

create index activities_stage_week_idx on public.activities (stage_id, week, position);

-- ---------------------------------------------------------------------------
-- Cohorts (instances of a programme)
-- ---------------------------------------------------------------------------
create table public.cohorts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id),
  program_id uuid not null references public.programs (id),
  name text not null,
  start_date date,
  timezone text not null default 'Asia/Karachi',
  schedule jsonb,                             -- e.g. {"weekday": 6, "start": "11:00", "end": "12:30"}
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.cohort_role not null,
  age_group public.age_group,
  fee_amount numeric(10, 2),
  discount_reason text,                       -- e.g. 'sibling'
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (cohort_id, user_id),
  check (role <> 'student' or age_group is not null)
);

create index memberships_user_idx on public.memberships (user_id);

-- Cohort roles must match the global role (only mentors/admins mentor, only students study).
create function public.check_membership_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  global_role public.app_role;
begin
  select role into global_role from public.profiles where id = new.user_id;
  if new.role = 'student' and global_role <> 'student' then
    raise exception 'Only student profiles can join a cohort as students';
  end if;
  if new.role = 'mentor' and global_role not in ('mentor', 'admin') then
    raise exception 'Only mentor or admin profiles can join a cohort as mentors';
  end if;
  return new;
end;
$$;

create trigger memberships_role_check before insert or update on public.memberships
  for each row execute function public.check_membership_role();

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts (id) on delete cascade,
  starts_at timestamptz not null,
  title text,
  join_url text,
  recording_url text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Student work
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  cohort_id uuid not null references public.cohorts (id) on delete cascade,
  area public.project_area not null default 'undecided',
  title text,
  problem text,
  status public.project_status not null default 'exploring',
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, cohort_id)
);

create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

-- Resubmitting after feedback creates a new row; students never edit past submissions.
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id),
  student_id uuid not null references public.profiles (id) on delete cascade,
  cohort_id uuid not null references public.cohorts (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  body text not null default '',
  link_url text,
  status public.submission_status not null default 'submitted',
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index submissions_cohort_student_idx on public.submissions (cohort_id, student_id);

create trigger submissions_updated_at before update on public.submissions
  for each row execute function public.set_updated_at();

create table public.submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  storage_path text not null,                 -- <cohort_id>/<student_id>/<file>
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  mentor_id uuid references public.profiles (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger feedback_updated_at before update on public.feedback
  for each row execute function public.set_updated_at();

create table public.progress_cards (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  cohort_id uuid not null references public.cohorts (id) on delete cascade,
  week int not null check (week >= 1),
  body text not null default '',
  status public.card_status not null default 'draft',
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  viewed_at timestamptz,                      -- first time a parent opened it
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, cohort_id, week)
);

create trigger progress_cards_updated_at before update on public.progress_cards
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Operations
-- ---------------------------------------------------------------------------
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id),
  email text not null,
  role public.app_role not null check (role in ('parent', 'mentor', 'admin')),
  cohort_id uuid references public.cohorts (id) on delete cascade,
  invited_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  cohort_id uuid references public.cohorts (id) on delete cascade,   -- null = global
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  unique nulls not distinct (key, cohort_id)
);

-- Ids and column names only; never row contents, so the log holds no children's data.
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  changed_columns text[],
  at timestamptz not null default now()
);

create index audit_log_entity_idx on public.audit_log (entity, entity_id);

-- ---------------------------------------------------------------------------
-- Permission helpers (security definer so policies don't recurse through RLS)
-- ---------------------------------------------------------------------------
create function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create function public.is_cohort_member(p_cohort uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.memberships where cohort_id = p_cohort and user_id = auth.uid());
$$;

create function public.is_cohort_mentor(p_cohort uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships
    where cohort_id = p_cohort and user_id = auth.uid() and role = 'mentor'
  );
$$;

create function public.is_parent_of(p_student uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.guardian_links where parent_id = auth.uid() and student_id = p_student);
$$;

-- The current user mentors a cohort this student belongs to.
create function public.mentors_student(p_student uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.memberships s on s.cohort_id = m.cohort_id
    where m.user_id = auth.uid() and m.role = 'mentor'
      and s.user_id = p_student and s.role = 'student'
  );
$$;

-- The current user is a parent of a student in this cohort.
create function public.is_parent_in_cohort(p_cohort uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.guardian_links g
    join public.memberships s on s.user_id = g.student_id
    where g.parent_id = auth.uid() and s.cohort_id = p_cohort
  );
$$;

create function public.has_active_consent(p_student uuid, p_type public.consent_type)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.consents
    where student_id = p_student and type = p_type and revoked_at is null
  );
$$;

-- Who may see a student's records: themselves, their parent, their mentor, or an admin.
create function public.can_view_student(p_student uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select auth.uid() = p_student
      or public.is_parent_of(p_student)
      or public.mentors_student(p_student)
      or public.is_admin();
$$;

-- ---------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------

-- A portfolio can only be public while a parent's public_portfolio consent is active.
create function public.check_project_public()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_public and not public.has_active_consent(new.student_id, 'public_portfolio') then
    raise exception 'A parent must consent to a public portfolio first';
  end if;
  return new;
end;
$$;

create trigger projects_public_check before insert or update on public.projects
  for each row execute function public.check_project_public();

-- Revoking public_portfolio consent immediately hides the portfolio.
create function public.unpublish_on_consent_revoke()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type = 'public_portfolio' and new.revoked_at is not null
     and not public.has_active_consent(new.student_id, 'public_portfolio') then
    update public.projects set is_public = false where student_id = new.student_id;
  end if;
  return new;
end;
$$;

create trigger consents_unpublish after update of revoked_at on public.consents
  for each row execute function public.unpublish_on_consent_revoke();

-- Approving a card records who approved it and when.
create function public.stamp_card_approval()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status <> 'approved') then
    new.approved_by = auth.uid();
    new.approved_at = now();
  elsif new.status = 'draft' then
    new.approved_by = null;
    new.approved_at = null;
  end if;
  return new;
end;
$$;

create trigger progress_cards_approval before insert or update on public.progress_cards
  for each row execute function public.stamp_card_approval();

-- ---------------------------------------------------------------------------
-- Audit log trigger
-- ---------------------------------------------------------------------------
create function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec jsonb;
  cols text[];
begin
  if tg_op = 'DELETE' then
    rec := to_jsonb(old);
  else
    rec := to_jsonb(new);
  end if;

  if tg_op = 'UPDATE' then
    select array_agg(n.key order by n.key) into cols
    from jsonb_each(to_jsonb(new)) n
    join jsonb_each(to_jsonb(old)) o using (key)
    where n.value is distinct from o.value and n.key <> 'updated_at';
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, changed_columns)
  values (auth.uid(), lower(tg_op), tg_table_name, (rec ->> 'id')::uuid, cols);

  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'guardian_links', 'consents', 'cohorts', 'memberships', 'projects',
    'submissions', 'submission_files', 'feedback', 'progress_cards', 'invitations'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.write_audit_log()',
      t || '_audit', t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.guardian_links enable row level security;
alter table public.consents enable row level security;
alter table public.programs enable row level security;
alter table public.stages enable row level security;
alter table public.activities enable row level security;
alter table public.cohorts enable row level security;
alter table public.memberships enable row level security;
alter table public.sessions enable row level security;
alter table public.projects enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_files enable row level security;
alter table public.feedback enable row level security;
alter table public.progress_cards enable row level security;
alter table public.invitations enable row level security;
alter table public.feature_flags enable row level security;
alter table public.audit_log enable row level security;

-- organizations
create policy "members read organizations" on public.organizations
  for select to authenticated using (true);
create policy "admins manage organizations" on public.organizations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- profiles: self, linked family, mentors of the student, students' own mentors, admins
create policy "read visible profiles" on public.profiles
  for select to authenticated using (
    id = auth.uid()
    or public.can_view_student(id)
    or exists (                                  -- parents and students see their cohort mentors
      select 1 from public.memberships mm
      where mm.user_id = profiles.id and mm.role = 'mentor'
        and (public.is_cohort_member(mm.cohort_id) or public.is_parent_in_cohort(mm.cohort_id))
    )
    or exists (                                  -- mentors see the parents of their students
      select 1 from public.guardian_links g
      where g.parent_id = profiles.id and public.mentors_student(g.student_id)
    )
  );
create policy "update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "admins manage profiles" on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Users may only edit harmless columns of their own profile (never role, username or org).
revoke update on public.profiles from authenticated;
grant update (full_name, locale, timezone, country, prefers_female_mentor) on public.profiles to authenticated;

-- guardian_links: created by the server when a parent creates a child account
create policy "read own family links" on public.guardian_links
  for select to authenticated using (
    parent_id = auth.uid() or student_id = auth.uid()
    or public.mentors_student(student_id) or public.is_admin()
  );
create policy "admins manage family links" on public.guardian_links
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- consents: parents grant and revoke for their own children
create policy "read consents" on public.consents
  for select to authenticated using (public.can_view_student(student_id));
create policy "parents grant consent" on public.consents
  for insert to authenticated with check (
    parent_id = auth.uid() and public.is_parent_of(student_id) and revoked_at is null
  );
create policy "parents revoke consent" on public.consents
  for update to authenticated using (parent_id = auth.uid()) with check (parent_id = auth.uid());
create policy "admins manage consents" on public.consents
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke update on public.consents from authenticated;
grant update (revoked_at) on public.consents to authenticated;

-- programme template: readable by every signed-in user, editable by admins
create policy "read programs" on public.programs for select to authenticated using (true);
create policy "admins manage programs" on public.programs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "read stages" on public.stages for select to authenticated using (true);
create policy "admins manage stages" on public.stages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "read activities" on public.activities for select to authenticated using (true);
create policy "admins manage activities" on public.activities
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- cohorts
create policy "read own cohorts" on public.cohorts
  for select to authenticated using (
    public.is_cohort_member(id) or public.is_parent_in_cohort(id) or public.is_admin()
  );
create policy "admins manage cohorts" on public.cohorts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- memberships
create policy "read memberships" on public.memberships
  for select to authenticated using (
    user_id = auth.uid()
    or public.is_cohort_mentor(cohort_id)
    or public.is_parent_of(user_id)
    or (role = 'mentor' and (public.is_cohort_member(cohort_id) or public.is_parent_in_cohort(cohort_id)))
    or public.is_admin()
  );
create policy "admins manage memberships" on public.memberships
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- sessions
create policy "read sessions" on public.sessions
  for select to authenticated using (
    public.is_cohort_member(cohort_id) or public.is_parent_in_cohort(cohort_id) or public.is_admin()
  );
create policy "mentors manage sessions" on public.sessions
  for all to authenticated
  using (public.is_cohort_mentor(cohort_id) or public.is_admin())
  with check (public.is_cohort_mentor(cohort_id) or public.is_admin());

-- projects
create policy "read projects" on public.projects
  for select to authenticated using (public.can_view_student(student_id));
create policy "anyone reads consented public portfolios" on public.projects
  for select to anon, authenticated using (
    is_public and public.has_active_consent(student_id, 'public_portfolio')
  );
create policy "students create own project" on public.projects
  for insert to authenticated with check (
    student_id = auth.uid()
    and exists (
      select 1 from public.memberships m
      where m.cohort_id = projects.cohort_id and m.user_id = auth.uid() and m.role = 'student'
    )
  );
create policy "students and mentors update project" on public.projects
  for update to authenticated
  using (student_id = auth.uid() or public.is_cohort_mentor(cohort_id) or public.is_admin())
  with check (student_id = auth.uid() or public.is_cohort_mentor(cohort_id) or public.is_admin());

revoke update on public.projects from authenticated;
grant update (area, title, problem, status, is_public) on public.projects to authenticated;

-- submissions: students insert only; mentors set status
create policy "read submissions" on public.submissions
  for select to authenticated using (public.can_view_student(student_id));
create policy "students submit" on public.submissions
  for insert to authenticated with check (
    student_id = auth.uid()
    and status = 'submitted'
    and exists (
      select 1 from public.memberships m
      where m.cohort_id = submissions.cohort_id and m.user_id = auth.uid() and m.role = 'student'
    )
  );
create policy "mentors review submissions" on public.submissions
  for update to authenticated
  using (public.is_cohort_mentor(cohort_id) or public.is_admin())
  with check (public.is_cohort_mentor(cohort_id) or public.is_admin());

revoke update on public.submissions from authenticated;
grant update (status) on public.submissions to authenticated;

-- submission files follow their submission
create policy "read submission files" on public.submission_files
  for select to authenticated using (
    exists (select 1 from public.submissions s
            where s.id = submission_id and public.can_view_student(s.student_id))
  );
create policy "students attach files" on public.submission_files
  for insert to authenticated with check (
    exists (select 1 from public.submissions s
            where s.id = submission_id and s.student_id = auth.uid())
  );

-- feedback
create policy "read feedback" on public.feedback
  for select to authenticated using (
    exists (select 1 from public.submissions s
            where s.id = submission_id and public.can_view_student(s.student_id))
  );
create policy "mentors write feedback" on public.feedback
  for insert to authenticated with check (
    mentor_id = auth.uid()
    and exists (select 1 from public.submissions s
                where s.id = submission_id and (public.is_cohort_mentor(s.cohort_id) or public.is_admin()))
  );
create policy "mentors edit own feedback" on public.feedback
  for update to authenticated using (mentor_id = auth.uid()) with check (mentor_id = auth.uid());

-- progress cards: parents only ever see approved cards; students don't see them
create policy "mentors manage progress cards" on public.progress_cards
  for all to authenticated
  using (public.is_cohort_mentor(cohort_id) or public.is_admin())
  with check (public.is_cohort_mentor(cohort_id) or public.is_admin());
create policy "parents read approved cards" on public.progress_cards
  for select to authenticated using (status = 'approved' and public.is_parent_of(student_id));

-- operations tables
create policy "admins manage invitations" on public.invitations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "read feature flags" on public.feature_flags for select to authenticated using (true);
create policy "admins manage feature flags" on public.feature_flags
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins read audit log" on public.audit_log
  for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.audit_log from anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Parents mark a card as opened (the only change a parent can make to a card).
create function public.mark_progress_card_viewed(p_card uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.progress_cards
  set viewed_at = coalesce(viewed_at, now())
  where id = p_card and status = 'approved' and public.is_parent_of(student_id);
end;
$$;

-- Everything stored about one student, for data-access requests (parent or admin only).
create function public.export_student_data(p_student uuid)
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
                       from public.progress_cards pc where pc.student_id = p_student and pc.status = 'approved')
  );
end;
$$;

revoke execute on function public.export_student_data(uuid) from anon;
revoke execute on function public.mark_progress_card_viewed(uuid) from anon;

-- ---------------------------------------------------------------------------
-- Storage: private bucket, paths are <cohort_id>/<student_id>/<file>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'submissions', 'submissions', false, 26214400,     -- 25 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf',
        'video/mp4', 'text/plain',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
);

create policy "students upload own files" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'submissions'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.is_cohort_member(((storage.foldername(name))[1])::uuid)
  );

create policy "read visible submission files" on storage.objects
  for select to authenticated using (
    bucket_id = 'submissions'
    and public.can_view_student(((storage.foldername(name))[2])::uuid)
  );
