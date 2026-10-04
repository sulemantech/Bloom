-- Row-level security tests: each role sees and changes only what it should.
-- Run with: npm run db:test
begin;
-- The CLI connects with a login role; act as postgres for fixtures (RLS bypassed).
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres, RLS bypassed)
-- admin; mentor M1 → cohort C1, mentor M2 → cohort C2
-- parent P1 → student S1 (C1, explorer); parent P2 → student S2 (C2, builder)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_app_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'admin@test.local',  '{"role": "admin"}'),
  ('b0000000-0000-0000-0000-000000000001', 'm1@test.local',     '{"role": "mentor"}'),
  ('b0000000-0000-0000-0000-000000000002', 'm2@test.local',     '{"role": "mentor"}'),
  ('c0000000-0000-0000-0000-000000000001', 'p1@test.local',     '{}'),
  ('c0000000-0000-0000-0000-000000000002', 'p2@test.local',     '{}'),
  ('d0000000-0000-0000-0000-000000000001', 's1@students.local', '{"role": "student", "username": "s1"}'),
  ('d0000000-0000-0000-0000-000000000002', 's2@students.local', '{"role": "student", "username": "s2"}');

insert into public.cohorts (id, program_id, name)
select 'e0000000-0000-0000-0000-000000000002', id, 'Group 2' from public.programs limit 1;

insert into public.memberships (cohort_id, user_id, role, age_group) values
  ('00000000-0000-0000-0000-000000001001', 'b0000000-0000-0000-0000-000000000001', 'mentor', null),
  ('e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'mentor', null),
  ('00000000-0000-0000-0000-000000001001', 'd0000000-0000-0000-0000-000000000001', 'student', 'explorer'),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'student', 'builder');

insert into public.guardian_links (parent_id, student_id) values
  ('c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002');

insert into public.projects (id, student_id, cohort_id, area) values
  ('80000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000001001', 'design'),
  ('80000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'technology');

insert into public.submissions (id, activity_id, student_id, cohort_id, body)
select 'f0000000-0000-0000-0000-000000000001', a.id, 'd0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000001001', 'S1 work'
from public.activities a order by a.week, a.position limit 1;
insert into public.submissions (id, activity_id, student_id, cohort_id, body)
select 'f0000000-0000-0000-0000-000000000002', a.id, 'd0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'S2 work'
from public.activities a order by a.week, a.position limit 1;

insert into public.progress_cards (id, student_id, cohort_id, week, body, status) values
  ('90000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000001001', 1, 'Great start', 'approved'),
  ('90000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000001001', 2, 'Draft', 'draft');

-- ---------------------------------------------------------------------------
-- Signup trigger and integrity rules
-- ---------------------------------------------------------------------------
select is((select role from public.profiles where id = 'c0000000-0000-0000-0000-000000000001'),
          'parent'::public.app_role, 'self sign-ups become parents');
select is((select username from public.profiles where id = 'd0000000-0000-0000-0000-000000000001'),
          's1', 'student username comes from app_metadata');
select throws_ok(
  $$insert into public.memberships (cohort_id, user_id, role, age_group)
    values ('00000000-0000-0000-0000-000000001001', 'c0000000-0000-0000-0000-000000000001', 'student', 'explorer')$$,
  'P0001', null, 'a parent cannot join a cohort as a student');

-- ---------------------------------------------------------------------------
-- Student S1
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "d0000000-0000-0000-0000-000000000001", "role": "authenticated"}';

select is((select count(*)::int from public.profiles where id = 'd0000000-0000-0000-0000-000000000002'), 0,
          'student cannot see another student''s profile');
select is((select count(*)::int from public.profiles where id = 'b0000000-0000-0000-0000-000000000001'), 1,
          'student can see their mentor''s profile');
select is((select count(*)::int from public.submissions), 1, 'student sees only their own submissions');
select is((select count(*)::int from public.progress_cards), 0, 'student does not see progress cards');
select is((select count(*)::int from public.audit_log), 0, 'student cannot read the audit log');
select is((select count(*)::int from public.cohorts), 1, 'student sees only their own cohort');
select throws_ok(
  $$update public.profiles set role = 'admin' where id = 'd0000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'student cannot change their own role');
select lives_ok(
  $$insert into public.submissions (activity_id, student_id, cohort_id, body)
    select id, 'd0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000001001', 'second try'
    from public.activities limit 1$$,
  'student can submit in their own cohort');
select throws_ok(
  $$insert into public.submissions (activity_id, student_id, cohort_id, body)
    select id, 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'wrong group'
    from public.activities limit 1$$,
  '42501', null, 'student cannot submit into another cohort');
select throws_ok(
  $$insert into public.submissions (activity_id, student_id, cohort_id, body)
    select id, 'd0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'impersonation'
    from public.activities limit 1$$,
  '42501', null, 'student cannot submit as someone else');
update public.submissions set status = 'done' where id = 'f0000000-0000-0000-0000-000000000001';
select throws_ok(
  $$update public.projects set is_public = true where id = '80000000-0000-0000-0000-000000000001'$$,
  'P0001', null, 'portfolio cannot go public without parental consent');
select throws_ok(
  $$update public.projects set cohort_id = 'e0000000-0000-0000-0000-000000000002'
    where id = '80000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'student cannot move their project to another cohort');

set local role postgres;
select is((select status from public.submissions where id = 'f0000000-0000-0000-0000-000000000001'),
          'submitted'::public.submission_status, 'student cannot mark their own submission as done');

-- ---------------------------------------------------------------------------
-- Parent P1
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "c0000000-0000-0000-0000-000000000001", "role": "authenticated"}';

select is((select count(*)::int from public.profiles where id = 'd0000000-0000-0000-0000-000000000001'), 1,
          'parent sees their child');
select is((select count(*)::int from public.profiles where id = 'd0000000-0000-0000-0000-000000000002'), 0,
          'parent cannot see another child');
select is((select count(*)::int from public.submissions where student_id = 'd0000000-0000-0000-0000-000000000002'), 0,
          'parent cannot see another child''s submissions');
select ok((select count(*) from public.submissions where student_id = 'd0000000-0000-0000-0000-000000000001') > 0,
          'parent sees their child''s submissions');
select is((select count(*)::int from public.progress_cards), 1, 'parent sees only approved cards');
select is((select count(*)::int from public.projects where student_id = 'd0000000-0000-0000-0000-000000000002'), 0,
          'parent cannot see another child''s project');
select throws_ok(
  $$insert into public.consents (student_id, parent_id, type, version)
    values ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'platform', 'v1')$$,
  '42501', null, 'parent cannot consent for someone else''s child');
select lives_ok(
  $$insert into public.consents (student_id, parent_id, type, version)
    values ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'public_portfolio', 'v1')$$,
  'parent can consent to a public portfolio for their child');
select lives_ok(
  $$select public.mark_progress_card_viewed('90000000-0000-0000-0000-000000000001')$$,
  'parent can mark a card as viewed');
select lives_ok(
  $$select public.export_student_data('d0000000-0000-0000-0000-000000000001')$$,
  'parent can export their child''s data');
select throws_ok(
  $$select public.export_student_data('d0000000-0000-0000-0000-000000000002')$$,
  'P0001', null, 'parent cannot export another child''s data');

set local role postgres;
select isnt((select viewed_at from public.progress_cards where id = '90000000-0000-0000-0000-000000000001'),
            null, 'viewed_at is recorded');

-- ---------------------------------------------------------------------------
-- Public portfolio follows consent
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "d0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select lives_ok(
  $$update public.projects set is_public = true where id = '80000000-0000-0000-0000-000000000001'$$,
  'student can publish once a parent has consented');

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select is((select count(*)::int from public.projects), 1, 'anonymous visitors see the consented public portfolio');
select is((select count(*)::int from public.submissions), 0, 'anonymous visitors see no submissions');
select is((select count(*)::int from public.profiles), 0, 'anonymous visitors see no profiles');

set local role authenticated;
set local request.jwt.claims to '{"sub": "c0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
update public.consents set revoked_at = now()
where student_id = 'd0000000-0000-0000-0000-000000000001' and type = 'public_portfolio';

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select is((select count(*)::int from public.projects), 0, 'revoking consent hides the portfolio');

-- ---------------------------------------------------------------------------
-- Mentor M1 (cohort C1) and mentor M2 (cohort C2)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "b0000000-0000-0000-0000-000000000001", "role": "authenticated"}';

select ok((select count(*) from public.submissions where student_id = 'd0000000-0000-0000-0000-000000000001') > 0,
          'mentor sees submissions in their cohort');
select is((select count(*)::int from public.submissions where student_id = 'd0000000-0000-0000-0000-000000000002'), 0,
          'mentor cannot see submissions in another cohort');
select is((select count(*)::int from public.progress_cards), 2, 'mentor sees draft and approved cards for their cohort');
select is((select count(*)::int from public.profiles where id = 'c0000000-0000-0000-0000-000000000001'), 1,
          'mentor sees the parents of their students');
select lives_ok(
  $$update public.submissions set status = 'done' where id = 'f0000000-0000-0000-0000-000000000001'$$,
  'mentor can review a submission');
select lives_ok(
  $$insert into public.feedback (submission_id, mentor_id, body)
    values ('f0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Nice work')$$,
  'mentor can give feedback in their cohort');
select throws_ok(
  $$insert into public.feedback (submission_id, mentor_id, body)
    values ('f0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Not my group')$$,
  '42501', null, 'mentor cannot give feedback in another cohort');
select throws_ok(
  $$insert into public.memberships (cohort_id, user_id, role)
    values ('e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'mentor')$$,
  '42501', null, 'mentor cannot add themselves to another cohort');

set local role postgres;
select is((select status from public.submissions where id = 'f0000000-0000-0000-0000-000000000001'),
          'done'::public.submission_status, 'mentor review was saved');

set local role authenticated;
set local request.jwt.claims to '{"sub": "b0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select is((select count(*)::int from public.progress_cards), 0, 'mentor of another cohort sees no cards');

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select is((select count(*)::int from public.submissions), 3, 'admin sees every submission');
select ok((select count(*) from public.audit_log) > 0, 'admin can read the audit log');
select is((select count(*)::int from public.audit_log where actor_id is not null and entity = 'feedback'), 1,
          'audit log records who gave feedback');

set local role postgres;
select * from finish();
rollback;
