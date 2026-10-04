-- Youth IdeaLab programme template (8 weeks, 4 steps) and a first cohort.
-- Activities with age_group null are for both groups; otherwise 'explorer' (12–14) or 'builder' (15–18).

insert into public.organizations (id, name)
values ('00000000-0000-0000-0000-000000000001', 'MetaFront LLP');

insert into public.programs (id, organization_id, slug, name, weeks)
values (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'youth-idea-lab-8-week',
  '{"en": "Youth Idea Lab — 8-week course"}',
  8
);

insert into public.stages (id, program_id, position, key, name, summary, week_from, week_to) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000010', 1, 'explore',
   '{"en": "Explore"}',
   '{"en": "Short, hands-on activities in tech, design, business and social impact help them find what they enjoy."}', 1, 2),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000010', 2, 'choose',
   '{"en": "Choose"}',
   '{"en": "With a mentor, they pick one real problem and talk to people who have it."}', 3, 4),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000010', 3, 'build',
   '{"en": "Build"}',
   '{"en": "They make a first working version, test it with real users and improve it."}', 5, 6),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000010', 4, 'present',
   '{"en": "Present"}',
   '{"en": "They finish a portfolio page and present their project live at Demo Day."}', 7, 8);

insert into public.activities (stage_id, week, position, age_group, submission_type, title, instructions) values
  -- Step 1: Explore (weeks 1–2)
  ('00000000-0000-0000-0000-000000000101', 1, 1, null, 'text',
   '{"en": "What do you enjoy?"}',
   '{"en": "List 5 things you enjoy doing and 3 problems you notice at home, school or in your community. For each problem, write one sentence about who it affects."}'),
  ('00000000-0000-0000-0000-000000000101', 1, 2, 'explorer', 'file',
   '{"en": "Design challenge in Canva"}',
   '{"en": "In Canva, make a poster for a club or event you would love to start. Upload it as an image or PDF."}'),
  ('00000000-0000-0000-0000-000000000101', 1, 2, 'builder', 'text_and_file',
   '{"en": "Redesign something you use"}',
   '{"en": "Pick an app, website or shop you use. Write what frustrates you about it and sketch or mock up one improvement. Upload your sketch or mockup."}'),
  ('00000000-0000-0000-0000-000000000101', 2, 1, null, 'text_and_file',
   '{"en": "Try two project areas"}',
   '{"en": "Try a mini task in two areas — technology, design, business or social impact. Share what you made and which area you enjoyed more, and why."}'),
  ('00000000-0000-0000-0000-000000000101', 2, 2, null, 'text',
   '{"en": "My three idea seeds"}',
   '{"en": "Write three project ideas, each as: the problem, who has it, and what you might build. Your mentor will help you choose in Week 3."}'),

  -- Step 2: Choose (weeks 3–4)
  ('00000000-0000-0000-0000-000000000102', 3, 1, null, 'text',
   '{"en": "Pick one real problem"}',
   '{"en": "With your mentor, choose one problem. Write it in one sentence: \"[Who] struggles with [what] because [why].\""}'),
  ('00000000-0000-0000-0000-000000000102', 3, 2, 'explorer', 'text',
   '{"en": "Talk to 3 people"}',
   '{"en": "Ask 3 people who have this problem about it (family, classmates or neighbours). Write down what surprised you."}'),
  ('00000000-0000-0000-0000-000000000102', 3, 2, 'builder', 'text',
   '{"en": "Interview 10 real users"}',
   '{"en": "Interview at least 10 people who have this problem. Record their answers in a table and summarise the 3 biggest patterns."}'),
  ('00000000-0000-0000-0000-000000000102', 4, 1, null, 'text_and_file',
   '{"en": "Plan your solution"}',
   '{"en": "Describe what you will build (website, app, brand, business page or campaign), who it is for, and sketch the first screen or design."}'),

  -- Step 3: Build (weeks 5–6)
  ('00000000-0000-0000-0000-000000000103', 5, 1, 'explorer', 'link',
   '{"en": "Build sprint: first version"}',
   '{"en": "In a 3–4 day sprint, make the first version of your project in Canva or a no-code tool. Share the link."}'),
  ('00000000-0000-0000-0000-000000000103', 5, 1, 'builder', 'link',
   '{"en": "Build sprint: working prototype"}',
   '{"en": "Ship a first working version of your website, app, brand or business page. Share the link and list what works and what does not yet."}'),
  ('00000000-0000-0000-0000-000000000103', 6, 1, null, 'text',
   '{"en": "Test with real users"}',
   '{"en": "Show your project to at least 3 people who have the problem. Write what they liked, where they got stuck, and what you will change."}'),
  ('00000000-0000-0000-0000-000000000103', 6, 2, null, 'link',
   '{"en": "Improve it"}',
   '{"en": "Make the changes from your user tests. Share the updated link and a short note on what changed."}'),

  -- Step 4: Present (weeks 7–8)
  ('00000000-0000-0000-0000-000000000104', 7, 1, null, 'text_and_file',
   '{"en": "Tell your project story"}',
   '{"en": "Write your project story for your portfolio: the problem, who you talked to, what you built, and what you learned. Add 2–3 images."}'),
  ('00000000-0000-0000-0000-000000000104', 7, 2, null, 'file',
   '{"en": "Demo Day slides"}',
   '{"en": "Make 5 slides for Demo Day: problem, people, solution, demo, what is next. Upload them as PDF or PowerPoint."}'),
  ('00000000-0000-0000-0000-000000000104', 8, 1, null, 'text',
   '{"en": "Demo Day reflection"}',
   '{"en": "After presenting, write what you are proud of, what you would do differently, and what you want to build next."}');

insert into public.cohorts (id, organization_id, program_id, name, start_date, timezone, schedule)
values (
  '00000000-0000-0000-0000-000000001001',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  'Group 1',
  null,                                          -- next start date: to be confirmed
  'Asia/Karachi',
  '{"weekday": 6, "start": "11:00", "end": "12:30"}'
);
