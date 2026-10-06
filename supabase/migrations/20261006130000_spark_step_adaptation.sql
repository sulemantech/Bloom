-- Spark adaptive steps: show the student how their feedback changed a step.
--   adaptation    Spark's one-line note to the student on what it changed in this step and why
--   adapted_from  the finished step whose feedback (feeling, note, questions) this step was written from

alter table public.bloom_tasks
  add column adaptation text check (char_length(adaptation) <= 500),
  add column adapted_from uuid references public.bloom_tasks (id) on delete set null;

grant update (adaptation, adapted_from) on public.bloom_tasks to authenticated;
