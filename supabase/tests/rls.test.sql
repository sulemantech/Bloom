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

-- The admin API sets app_metadata after insert; the profile must follow.
insert into auth.users (id, email) values ('c0000000-0000-0000-0000-000000000009', 'late@test.local');
update auth.users set raw_app_meta_data = '{"role": "mentor"}' where id = 'c0000000-0000-0000-0000-000000000009';
select is((select role from public.profiles where id = 'c0000000-0000-0000-0000-000000000009'),
          'mentor'::public.app_role, 'a role set after sign-up updates the profile');

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
select is((select count(*)::int from public.progress_cards where student_id = 'd0000000-0000-0000-0000-000000000001'), 2,
          'mentor sees draft and approved cards for their cohort');
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
select is((select count(*)::int from public.submissions where student_id in ('d0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002')), 3,
          'admin sees every submission');

-- Admin operations (the test admin is the only admin inside this rolled-back transaction)
set local role postgres;
update public.profiles set role = 'parent' where role = 'admin' and id <> 'a0000000-0000-0000-0000-000000000001';
set local role authenticated;
select lives_ok(
  $$select public.admin_update_profile('d0000000-0000-0000-0000-000000000001', 'Renamed Student', 'student', 's1.new', 2013, 'PK', 'Asia/Karachi', true)$$,
  'admin can edit a student profile');
select is((select username from public.profiles where id = 'd0000000-0000-0000-0000-000000000001'), 's1.new', 'admin edit saved');
select throws_ok(
  $$select public.admin_update_profile('d0000000-0000-0000-0000-000000000001', 'X', 'parent', null, null, null, null, false)$$,
  'P0001', null, 'a student cannot be turned into a parent');
select throws_ok(
  $$select public.admin_update_profile('b0000000-0000-0000-0000-000000000001', 'M1', 'parent', null, null, null, null, false)$$,
  'P0001', null, 'a mentor who mentors a group cannot be demoted to parent');
select throws_ok(
  $$select public.admin_update_profile('a0000000-0000-0000-0000-000000000001', 'Admin', 'mentor', null, null, null, null, false)$$,
  'P0001', null, 'the last admin cannot be demoted');
select lives_ok($$select public.log_admin_action('password_reset', 'profiles', 'd0000000-0000-0000-0000-000000000001')$$,
  'admin can log an auth action');
select is((select count(*)::int from public.audit_log where action = 'password_reset' and actor_id = 'a0000000-0000-0000-0000-000000000001'), 1,
  'logged action records the admin');
select is((select count(*)::int from public.audit_log where entity = 'profiles' and action = 'update'
           and entity_id = 'd0000000-0000-0000-0000-000000000001'
           and actor_id = 'a0000000-0000-0000-0000-000000000001'), 1, 'profile edit is attributed to the admin');

set local request.jwt.claims to '{"sub": "c0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select throws_ok(
  $$select public.admin_update_profile('c0000000-0000-0000-0000-000000000001', 'Me', 'admin', null, null, null, null, false)$$,
  '42501', null, 'a parent cannot make themselves admin');
select throws_ok($$select public.log_admin_action('x', 'profiles', null)$$, '42501', null, 'a parent cannot write the audit log');
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select ok((select count(*) from public.audit_log) > 0, 'admin can read the audit log');
select is((select count(*)::int from public.audit_log where actor_id = 'b0000000-0000-0000-0000-000000000001' and entity = 'feedback'), 1,
          'audit log records who gave feedback');

-- ---------------------------------------------------------------------------
-- Bloom: students own their learning; parents, mentors and admins can read it
-- ---------------------------------------------------------------------------
set local role postgres;
insert into public.bloom_paths (id, student_id, cohort_id, title) values
  ('70000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000001001', 'S1 path'),
  ('70000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'S2 path');

set local role authenticated;
set local request.jwt.claims to '{"sub": "d0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select is((select count(*)::int from public.bloom_paths), 1, 'student sees only their own Bloom paths');
select lives_ok(
  $$insert into public.bloom_tasks (id, path_id, student_id, title)
    values ('71000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Step 1')$$,
  'student can add a step to their own path');
select throws_ok(
  $$insert into public.bloom_tasks (path_id, student_id, title)
    values ('70000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'Sneaky')$$,
  '42501', null, 'student cannot add a step to someone else''s path');
select throws_ok(
  $$insert into public.bloom_paths (student_id, title) values ('d0000000-0000-0000-0000-000000000002', 'Not mine')$$,
  '42501', null, 'student cannot create a path for another student');
select throws_ok(
  $$update public.bloom_paths set mentor_note = 'I am great' where id = '70000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'student cannot write the mentor note');
select throws_ok(
  $$select public.set_bloom_mentor_note('70000000-0000-0000-0000-000000000001', 'Self praise')$$,
  '42501', null, 'student cannot use the mentor note function');
update public.bloom_tasks set status = 'done' where id = '71000000-0000-0000-0000-000000000001';
select lives_ok(
  $$insert into public.bloom_questions (path_id, student_id, question, answer)
    values ('70000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Why?', 'Because.')$$,
  'student can record a question to Bloom');

set local role postgres;
select isnt((select completed_at from public.bloom_tasks where id = '71000000-0000-0000-0000-000000000001'),
            null, 'finishing a step records when');

set local role authenticated;
set local request.jwt.claims to '{"sub": "c0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select is((select count(*)::int from public.bloom_paths), 1, 'parent sees only their child''s Bloom paths');
select is((select count(*)::int from public.bloom_questions), 1, 'parent can read their child''s questions to Bloom');
select throws_ok(
  $$insert into public.bloom_paths (student_id, title) values ('c0000000-0000-0000-0000-000000000001', 'Parent path')$$,
  '42501', null, 'parents cannot create Bloom paths');

set local request.jwt.claims to '{"sub": "b0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select is((select count(*)::int from public.bloom_paths), 1, 'mentor sees Bloom paths of their own students only');
select lives_ok(
  $$select public.set_bloom_mentor_note('70000000-0000-0000-0000-000000000001', 'Great start!')$$,
  'mentor can leave a note on their student''s path');
select throws_ok(
  $$select public.set_bloom_mentor_note('70000000-0000-0000-0000-000000000002', 'Not my student')$$,
  '42501', null, 'mentor cannot leave a note for another group''s student');

set local role postgres;
select is((select mentor_note from public.bloom_paths where id = '70000000-0000-0000-0000-000000000001'),
          'Great start!', 'mentor note was saved');
select is((select mentor_note_by from public.bloom_paths where id = '70000000-0000-0000-0000-000000000001'),
          'b0000000-0000-0000-0000-000000000001'::uuid, 'mentor note records who wrote it');

set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select is((select count(*)::int from public.bloom_paths
           where id in ('70000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002')), 2,
          'admin sees every Bloom path');

-- ---------------------------------------------------------------------------
-- Bloom path integrity: atomic creation, status follows the steps
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "d0000000-0000-0000-0000-000000000001", "role": "authenticated"}';

select lives_ok(
  $$select public.create_bloom_path('Planned path', 'A goal', 'quick', 'Summary', true,
      '[{"kind": "learn", "title": "Read"}, {"kind": "do", "title": "Try", "details": "How"}]'::jsonb,
      '00000000-0000-0000-0000-000000001001', 'explore')$$,
  'student can create a path with its steps in one call');
select is((select count(*)::int from public.bloom_tasks t join public.bloom_paths p on p.id = t.path_id
           where p.title = 'Planned path'), 2, 'the planned steps were saved with the path');
select is((select string_agg(t.title, ',' order by t.position) from public.bloom_tasks t
           join public.bloom_paths p on p.id = t.path_id where p.title = 'Planned path'),
          'Read,Try', 'steps keep their planned order');

select throws_ok(
  $$select public.create_bloom_path('Broken plan', '', 'quick', '', true,
      '[{"kind": "learn", "title": "Fine"}, {"kind": "do", "title": ""}]'::jsonb)$$,
  '23514', null, 'a step that breaks a rule fails the whole path');
select is((select count(*)::int from public.bloom_paths where title = 'Broken plan'), 0,
          'no empty path is left behind when a step fails');

-- S1's path: its only step was finished above, so the path is completed.
select is((select status::text from public.bloom_paths where id = '70000000-0000-0000-0000-000000000001'),
          'completed', 'finishing the last step completes the path');
insert into public.bloom_tasks (id, path_id, student_id, title)
values ('71000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'One more');
select is((select status::text from public.bloom_paths where id = '70000000-0000-0000-0000-000000000001'),
          'active', 'adding a step to a completed path makes it active again');
update public.bloom_tasks set status = 'done' where id = '71000000-0000-0000-0000-000000000002';
update public.bloom_paths set status = 'archived' where id = '70000000-0000-0000-0000-000000000001';
select is((select status::text from public.bloom_paths where id = '70000000-0000-0000-0000-000000000001'),
          'archived', 'a student can archive a path');
update public.bloom_tasks set status = 'doing' where id = '71000000-0000-0000-0000-000000000002';
select is((select status::text from public.bloom_paths where id = '70000000-0000-0000-0000-000000000001'),
          'archived', 'changing a step does not unarchive the path');
update public.bloom_tasks set status = 'done' where id = '71000000-0000-0000-0000-000000000002';
update public.bloom_paths set status = 'active' where id = '70000000-0000-0000-0000-000000000001';
select is((select status::text from public.bloom_paths where id = '70000000-0000-0000-0000-000000000001'),
          'completed', 'restoring a path whose steps are all done brings it back completed');
update public.bloom_tasks set status = 'doing' where id = '71000000-0000-0000-0000-000000000002';
update public.bloom_paths set status = 'completed' where id = '70000000-0000-0000-0000-000000000001';
select is((select status::text from public.bloom_paths where id = '70000000-0000-0000-0000-000000000001'),
          'active', 'a path with an unfinished step cannot be marked completed');

set local role postgres;
select is((select completed_at is not null from public.bloom_paths where title = 'Planned path'), false,
          'a new path is not completed');
select * from finish();
rollback;
