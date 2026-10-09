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
-- Scoped to the test's own students, so demo data in a development database doesn't change the count.
select is((select count(*)::int from public.projects where student_id::text like 'd0000000-%'), 1, 'anonymous visitors see the consented public portfolio');
select is((select count(*)::int from public.submissions), 0, 'anonymous visitors see no submissions');
select is((select count(*)::int from public.profiles), 0, 'anonymous visitors see no profiles');

set local role authenticated;
set local request.jwt.claims to '{"sub": "c0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
update public.consents set revoked_at = now()
where student_id = 'd0000000-0000-0000-0000-000000000001' and type = 'public_portfolio';

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select is((select count(*)::int from public.projects where student_id::text like 'd0000000-%'), 0, 'revoking consent hides the portfolio');

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
insert into public.bloom_paths (id, student_id, cohort_id, title, anchor_kind, anchor_label) values
  ('70000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000001001', 'S1 path', 'stage', 'Explore'),
  ('70000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'S2 path', 'stage', 'Explore');

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
  $$insert into public.bloom_paths (student_id, cohort_id, title, anchor_kind, anchor_label)
    values ('d0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'Not mine', 'stage', 'Explore')$$,
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
  $$insert into public.bloom_paths (student_id, title, anchor_kind) values ('c0000000-0000-0000-0000-000000000001', 'Parent path', 'interest')$$,
  '42501', null, 'parents cannot create Bloom paths');

set local request.jwt.claims to '{"sub": "b0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select is((select count(*)::int from public.bloom_paths
           where id in ('70000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002')), 1,
          'mentor sees Bloom paths of their own students only');
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
      '00000000-0000-0000-0000-000000001001', 'explore', '{"kind": "stage", "label": "Explore"}'::jsonb)$$,
  'student can create a path with its steps in one call');
select is((select count(*)::int from public.bloom_tasks t join public.bloom_paths p on p.id = t.path_id
           where p.title = 'Planned path'), 2, 'the planned steps were saved with the path');
select is((select string_agg(t.title, ',' order by t.position) from public.bloom_tasks t
           join public.bloom_paths p on p.id = t.path_id where p.title = 'Planned path'),
          'Read,Try', 'steps keep their planned order');

select throws_ok(
  $$select public.create_bloom_path('Broken plan', '', 'quick', '', true,
      '[{"kind": "learn", "title": "Fine"}, {"kind": "do", "title": ""}]'::jsonb,
      '00000000-0000-0000-0000-000000001001', 'explore', '{"kind": "stage", "label": "Explore"}'::jsonb)$$,
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

-- ---------------------------------------------------------------------------
-- Spark adaptive steps: outline steps and how the student found each step
-- ---------------------------------------------------------------------------
insert into public.bloom_tasks (id, path_id, student_id, title)
values ('71000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'S2 step');

set local role authenticated;
set local request.jwt.claims to '{"sub": "d0000000-0000-0000-0000-000000000001", "role": "authenticated"}';

select lives_ok(
  $$select public.create_bloom_path('Outline path', '', 'standard', '', true,
      '[{"kind": "learn", "title": "Written", "details": "Full step"},
        {"kind": "do", "title": "Later", "details": "Aim only", "planned_only": true}]'::jsonb,
      '00000000-0000-0000-0000-000000001001', 'explore', '{"kind": "stage", "label": "Explore"}'::jsonb)$$,
  'student can create a path whose later steps are an outline');
select is((select string_agg(t.planned_only::text, ',' order by t.position) from public.bloom_tasks t
           join public.bloom_paths p on p.id = t.path_id where p.title = 'Outline path'),
          'false,true', 'outline steps are saved as planned_only; others default to written');

select lives_ok(
  $$update public.bloom_tasks set feeling = 'too_hard', status = 'done'
    where id = (select t.id from public.bloom_tasks t join public.bloom_paths p on p.id = t.path_id
                where p.title = 'Outline path' and t.position = 1)$$,
  'student can say how a step went as they finish it');
select throws_ok(
  $$update public.bloom_tasks set feeling = 'boring' where id = '71000000-0000-0000-0000-000000000002'$$,
  '22P02', null, 'only too_easy, just_right or too_hard are accepted');
select lives_ok(
  $$update public.bloom_tasks set title = 'Later, written', details = 'Full step', planned_only = false
    where planned_only and path_id = (select id from public.bloom_paths where title = 'Outline path')$$,
  'the student''s session can replace an outline step with the written step');
update public.bloom_tasks set feeling = 'too_easy' where id = '71000000-0000-0000-0000-000000000003';

set local role postgres;
select is((select feeling from public.bloom_tasks where id = '71000000-0000-0000-0000-000000000003'), null,
          'a student cannot set the feeling on another student''s step');
select is((select planned_only from public.bloom_tasks t join public.bloom_paths p on p.id = t.path_id
           where p.title = 'Outline path' and t.position = 2), false, 'the written step is no longer an outline');

set local role authenticated;
set local request.jwt.claims to '{"sub": "c0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select is((select feeling::text from public.bloom_tasks t join public.bloom_paths p on p.id = t.path_id
           where p.title = 'Outline path' and t.position = 1), 'too_hard', 'a parent sees how their child found a step');
select ok((public.export_student_data('d0000000-0000-0000-0000-000000000001') -> 'bloom_tasks') @> '[{"feeling": "too_hard"}]',
          'data export includes how the student found each step');

set local request.jwt.claims to '{"sub": "b0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select is((select count(*)::int from public.bloom_tasks t join public.bloom_paths p on p.id = t.path_id
           where p.title = 'Outline path'), 0, 'a mentor of another group cannot see the steps');

set local role postgres;

-- ---------------------------------------------------------------------------
-- Spark check your understanding: questions, answers and Spark's review
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "d0000000-0000-0000-0000-000000000001", "role": "authenticated"}';

select lives_ok(
  $$select public.create_bloom_path('Checked path', '', 'quick', '', true,
      '[{"kind": "learn", "title": "Learn it", "details": "Full step",
         "check_questions": [{"kind": "apply", "question": "Use it?"}, {"kind": "judge", "question": "Why?"}]}]'::jsonb,
      '00000000-0000-0000-0000-000000001001', 'explore', '{"kind": "stage", "label": "Explore"}'::jsonb)$$,
  'a planned step is saved with its check questions');
select is((select jsonb_array_length(t.check_questions) from public.bloom_tasks t join public.bloom_paths p on p.id = t.path_id
           where p.title = 'Checked path'), 2, 'both check questions were stored');
select is((select jsonb_array_length(t.check_questions) from public.bloom_tasks t join public.bloom_paths p on p.id = t.path_id
           where p.title = 'Outline path' and t.position = 1), 0, 'steps without questions default to none');

select lives_ok(
  $$update public.bloom_tasks set check_answers = '["By using it daily", ""]', status = 'done'
    where path_id = (select id from public.bloom_paths where title = 'Checked path')$$,
  'student can save their answers as they finish a step');
select throws_ok(
  $$update public.bloom_tasks set check_answers = '{"not": "a list"}'
    where path_id = (select id from public.bloom_paths where title = 'Checked path')$$,
  '23514', null, 'answers must be a list');
select lives_ok(
  $$update public.bloom_tasks set check_review = '[{"verdict": "nailed", "feedback": "Yes", "key_idea": "Daily use"}]'
    where path_id = (select id from public.bloom_paths where title = 'Checked path')$$,
  'the student''s session can store Spark''s review');
update public.bloom_tasks set check_answers = '["Sneaky"]' where id = '71000000-0000-0000-0000-000000000003';

set local request.jwt.claims to '{"sub": "c0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select is((select t.check_answers ->> 0 from public.bloom_tasks t join public.bloom_paths p on p.id = t.path_id
           where p.title = 'Checked path'), 'By using it daily', 'a parent can read their child''s answers');

set local role postgres;
select is((select check_answers from public.bloom_tasks where id = '71000000-0000-0000-0000-000000000003'), null,
          'a student cannot answer another student''s checks');

-- ---------------------------------------------------------------------------
-- Spark learner state: written as the student from reviews, readable like the rest of Spark
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "d0000000-0000-0000-0000-000000000001", "role": "authenticated"}';

select lives_ok(
  $$insert into public.spark_concepts (student_id, key, label, status, struggle_count)
    values ('d0000000-0000-0000-0000-000000000001', 'habit loop', 'Habit loop', 'struggling', 1)$$,
  'a student records evidence about their own learning');
select lives_ok(
  $$insert into public.spark_concepts (student_id, key, label, status, struggle_count)
    values ('d0000000-0000-0000-0000-000000000001', 'habit loop', 'Habit loop', 'understood', 1)
    on conflict (student_id, key) do update set status = excluded.status, nailed_count = public.spark_concepts.nailed_count + 1$$,
  'the same idea is updated, not duplicated');
select is((select status::text || '/' || nailed_count from public.spark_concepts where key = 'habit loop'), 'understood/1',
          'the latest evidence sets the status');
select throws_ok(
  $$insert into public.spark_concepts (student_id, key, label, status)
    values ('d0000000-0000-0000-0000-000000000002', 'x', 'X', 'struggling')$$,
  '42501', null, 'a student cannot write another student''s learner state');

set local request.jwt.claims to '{"sub": "c0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select is((select count(*)::int from public.spark_concepts where key = 'habit loop'), 1, 'a parent can read their child''s learner state');
select ok((public.export_student_data('d0000000-0000-0000-0000-000000000001') -> 'spark_concepts') @> '[{"key": "habit loop"}]',
          'data export includes the learner state');
select throws_ok(
  $$insert into public.spark_concepts (student_id, key, label, status)
    values ('d0000000-0000-0000-0000-000000000001', 'y', 'Y', 'understood')$$,
  '42501', null, 'a parent cannot change the learner state');

set local request.jwt.claims to '{"sub": "b0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select is((select count(*)::int from public.spark_concepts where key = 'habit loop'), 0,
          'a mentor of another group cannot see the learner state');

set local role postgres;

-- ---------------------------------------------------------------------------
-- Spark difficulty: recorded per written step, only known levels
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "d0000000-0000-0000-0000-000000000001", "role": "authenticated"}';

select lives_ok(
  $$select public.create_bloom_path('Pitched path', '', 'quick', '', true,
      '[{"kind": "learn", "title": "Easy start", "details": "Full step", "difficulty": "easier"},
        {"kind": "do", "title": "Later", "details": "Aim", "planned_only": true}]'::jsonb,
      '00000000-0000-0000-0000-000000001001', 'explore', '{"kind": "stage", "label": "Explore"}'::jsonb)$$,
  'a planned first step records the difficulty code decided for it');
select is((select string_agg(coalesce(t.difficulty, 'null'), ',' order by t.position) from public.bloom_tasks t
           join public.bloom_paths p on p.id = t.path_id where p.title = 'Pitched path'),
          'easier,null', 'outline steps get their difficulty when they are written');
select throws_ok(
  $$update public.bloom_tasks set difficulty = 'extreme'
    where path_id = (select id from public.bloom_paths where title = 'Pitched path')$$,
  '23514', null, 'only easier, same or harder are accepted');

set local role postgres;

-- ---------------------------------------------------------------------------
-- AI usage log: written by the server's secret key, read by admins only
-- ---------------------------------------------------------------------------
insert into public.ai_runs (capability, student_id, actor_id, model, input_tokens, output_tokens, latency_ms, outcome, input_hash)
values ('bloom_ask', 'd0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
        'claude-opus-5-5', 900, 120, 2100, 'ok', 'abc123');

set local role authenticated;
set local request.jwt.claims to '{"sub": "d0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select is((select count(*)::int from public.ai_runs), 0, 'a student cannot read AI usage, even their own');
select throws_ok(
  $$insert into public.ai_runs (capability, student_id, outcome) values ('bloom_ask', 'd0000000-0000-0000-0000-000000000001', 'ok')$$,
  '42501', null, 'a student cannot write AI usage');

set local request.jwt.claims to '{"sub": "c0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select is((select count(*)::int from public.ai_runs), 0, 'a parent cannot read AI usage');

set local request.jwt.claims to '{"sub": "b0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select is((select count(*)::int from public.ai_runs), 0, 'a mentor cannot read AI usage');

select is((select count(*)::int from public.ai_usage_by_day(now() - interval '1 day', 'Asia/Karachi')), 0,
          'a mentor gets no AI usage summary');

set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select is((select count(*)::int from public.ai_runs where input_hash = 'abc123'), 1, 'an admin reads AI usage');
select is((select sum(calls)::int from public.ai_usage_by_day(now() - interval '1 day', 'Asia/Karachi')),
          (select count(*)::int from public.ai_runs where created_at >= now() - interval '1 day'),
          'an admin gets the AI usage summary per day');
select is((select output_tokens::int from public.ai_usage_by_student(now() - interval '1 day')
           where student_id = 'd0000000-0000-0000-0000-000000000001'), 120,
          'AI usage per student adds up tokens');
select throws_ok(
  $$delete from public.ai_runs$$,
  '42501', null, 'not even an admin can delete AI usage through the API');

set local role postgres;
select is(
  (select count(*)::int from information_schema.columns
   where table_schema = 'public' and table_name = 'ai_runs' and column_name in ('prompt', 'input', 'output', 'answer', 'text')),
  0, 'ai_runs has no column for prompt or answer text');
-- ---------------------------------------------------------------------------
-- Spark anchors: every path serves a real need of the student's own course
-- ---------------------------------------------------------------------------
set local role postgres;
insert into public.programs (id, slug, name, weeks) values ('a1000000-0000-0000-0000-000000000001', 'other-course', '{"en": "Other"}', 4);
insert into public.stages (id, program_id, position, key, name, week_from, week_to)
  values ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 1, 'explore', '{"en": "Explore"}', 1, 4);
insert into public.activities (id, stage_id, week, title, instructions)
  values ('a3000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 1, '{"en": "Elsewhere"}', '{"en": "Not ours"}');

set local role authenticated;
set local request.jwt.claims to '{"sub": "d0000000-0000-0000-0000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$select public.create_bloom_path('Unanchored', '', 'quick', '', false, '[]'::jsonb, '00000000-0000-0000-0000-000000001001', 'explore')$$,
  '23502', null, 'a path cannot be created without an anchor');
select throws_ok(
  $$select public.create_bloom_path('Just curious', '', 'quick', '', false, '[]'::jsonb, null, null, '{"kind": "interest"}'::jsonb)$$,
  '23514', null, 'a student in a group cannot anchor a path to interest only, even without the group');
select lives_ok(
  format($$select public.create_bloom_path('For my activity', '', 'quick', '', false, '[]'::jsonb,
      '00000000-0000-0000-0000-000000001001', 'explore', %L::jsonb)$$,
    jsonb_build_object('kind', 'activity', 'label', 'Talk to 3 people', 'week', 3,
      'activity_id', (select a.id from public.activities a join public.stages s on s.id = a.stage_id
                      join public.cohorts c on c.program_id = s.program_id
                      where c.id = '00000000-0000-0000-0000-000000001001' limit 1))),
  'a path can serve a course activity of the student''s programme');
select is((select anchor_kind || ':' || anchor_label || ':' || anchor_week from public.bloom_paths where title = 'For my activity'),
          'activity:Talk to 3 people:3', 'the anchor is stored with the path');
select throws_ok(
  $$select public.create_bloom_path('Wrong course', '', 'quick', '', false, '[]'::jsonb,
      '00000000-0000-0000-0000-000000001001', 'explore',
      '{"kind": "activity", "label": "Elsewhere", "activity_id": "a3000000-0000-0000-0000-000000000001"}'::jsonb)$$,
  '23514', null, 'an activity from another programme is refused');
select lives_ok(
  $$select public.create_bloom_path('For my project', '', 'quick', '', false, '[]'::jsonb,
      '00000000-0000-0000-0000-000000001001', 'explore', '{"kind": "project", "label": "Plastic at school"}'::jsonb)$$,
  'a path can serve the student''s project');
select throws_ok(
  $$select public.create_bloom_path('Nameless', '', 'quick', '', false, '[]'::jsonb,
      '00000000-0000-0000-0000-000000001001', 'explore', '{"kind": "stage"}'::jsonb)$$,
  '23514', null, 'an anchor must say what it serves');
select throws_ok(
  $$update public.bloom_paths set anchor_label = 'Something else' where title = 'For my project'$$,
  '42501', null, 'the anchor is fixed once the path exists');

set local role postgres;
select lives_ok(
  $$insert into public.bloom_paths (student_id, title, anchor_kind)
    values ('c0000000-0000-0000-0000-000000000001', 'No group yet', 'interest')$$,
  'someone without a group can follow their own interest');

-- ---------------------------------------------------------------------------
-- Feature switches: admins only, every change audited; AI pauses are logged
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "b0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select throws_ok(
  $$insert into public.feature_flags (key, cohort_id, enabled) values ('ai', null, false)$$,
  '42501', null, 'a mentor cannot change a feature switch');

set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select lives_ok(
  $$insert into public.feature_flags (key, cohort_id, enabled) values ('ai', null, false)$$,
  'an admin can pause AI for everyone');
select is((select count(*)::int from public.audit_log
           where entity = 'feature_flags' and action = 'insert' and actor_id = 'a0000000-0000-0000-0000-000000000001'), 1,
          'the audit log records which admin changed a switch');
select lives_ok(
  $$delete from public.feature_flags where key = 'ai' and cohort_id is null$$,
  'an admin can put a switch back to its default');

set local role postgres;
select lives_ok(
  $$insert into public.ai_runs (capability, student_id, actor_id, outcome) values ('bloom_ask', 'd0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'paused')$$,
  'a call blocked by the AI master switch is logged as paused');

select * from finish();
rollback;
