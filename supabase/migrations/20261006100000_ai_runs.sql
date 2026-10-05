-- One row per AI call (roadmap task 0.3), written by the server's AI gateway with the secret key.
-- Records cost and reliability, never content: no prompt or answer text, only a hash of the input
-- so repeated calls can be spotted. Also the basis of each student's daily Bloom AI limit.
create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  capability text not null,                                       -- e.g. bloom_plan, progress_card
  student_id uuid references public.profiles (id) on delete cascade,  -- whose work or learning it was about
  actor_id uuid references public.profiles (id) on delete set null,   -- who asked (student or mentor)
  model text,                                                     -- the model that actually answered
  input_tokens int,
  output_tokens int,
  latency_ms int,
  outcome text not null check (outcome in ('ok', 'refused', 'rate_limited', 'failed', 'limited', 'no_consent')),
  input_hash text,
  created_at timestamptz not null default now()
);

create index ai_runs_student_idx on public.ai_runs (student_id, created_at desc);
create index ai_runs_created_idx on public.ai_runs (created_at desc);

alter table public.ai_runs enable row level security;

-- Only admins read it; nobody writes through the API (the gateway uses the secret key).
create policy "admins read ai runs" on public.ai_runs
  for select to authenticated using (public.is_admin());

revoke insert, update, delete on public.ai_runs from anon, authenticated;
