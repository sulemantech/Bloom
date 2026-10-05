-- AI usage summaries for the admin page (roadmap Phase 0 exit: "AI usage visible per day").
-- Aggregated in the database because ai_runs grows past the API's row limit within weeks.
-- Security invoker: ai_runs RLS still applies, so only admins get rows back.

-- Calls and tokens per day (in the viewer's time zone), capability and outcome.
create function public.ai_usage_by_day(p_since timestamptz, p_tz text)
returns table (
  day date,
  capability text,
  outcome text,
  calls int,
  input_tokens bigint,
  output_tokens bigint,
  latency_ms_total bigint,
  latency_calls int
)
language sql stable security invoker set search_path = ''
as $$
  select (r.created_at at time zone p_tz)::date, r.capability, r.outcome,
         count(*)::int,
         coalesce(sum(r.input_tokens), 0)::bigint,
         coalesce(sum(r.output_tokens), 0)::bigint,
         coalesce(sum(r.latency_ms), 0)::bigint,
         count(r.latency_ms)::int
  from public.ai_runs r
  where r.created_at >= p_since
  group by 1, 2, 3
$$;

-- Calls and tokens per student and outcome, to spot heavy use and limit hits.
create function public.ai_usage_by_student(p_since timestamptz)
returns table (
  student_id uuid,
  outcome text,
  calls int,
  input_tokens bigint,
  output_tokens bigint
)
language sql stable security invoker set search_path = ''
as $$
  select r.student_id, r.outcome, count(*)::int,
         coalesce(sum(r.input_tokens), 0)::bigint,
         coalesce(sum(r.output_tokens), 0)::bigint
  from public.ai_runs r
  where r.created_at >= p_since and r.student_id is not null
  group by 1, 2
$$;

revoke execute on function public.ai_usage_by_day(timestamptz, text) from public, anon;
revoke execute on function public.ai_usage_by_student(timestamptz) from public, anon;
grant execute on function public.ai_usage_by_day(timestamptz, text) to authenticated;
grant execute on function public.ai_usage_by_student(timestamptz) to authenticated;
