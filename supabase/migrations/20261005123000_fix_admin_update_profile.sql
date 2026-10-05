-- Fix: a variable named current_role shadowed the SQL current_role function in the first version.
create or replace function public.admin_update_profile(
  p_user uuid,
  p_full_name text,
  p_role public.app_role,
  p_username text,
  p_birth_year int,
  p_country text,
  p_timezone text,
  p_prefers_female_mentor boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select role into v_role from public.profiles where id = p_user;
  if v_role is null then
    raise exception 'Profile not found';
  end if;
  -- Students and adults are different kinds of account; switching between them isn't supported.
  if (v_role = 'student') <> (p_role = 'student') then
    raise exception 'A student account cannot become an adult account, or the reverse';
  end if;
  -- Mentoring a group needs a mentor or admin role.
  if p_role = 'parent' and exists (
    select 1 from public.memberships where user_id = p_user and role = 'mentor'
  ) then
    raise exception 'Remove this person from the groups they mentor first';
  end if;
  -- Never leave the organisation without an admin.
  if v_role = 'admin' and p_role <> 'admin'
     and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'There must always be at least one admin';
  end if;

  update public.profiles
  set full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
      role = p_role,
      username = case when p_role = 'student' then nullif(lower(trim(p_username)), '') else username end,
      birth_year = p_birth_year,
      country = nullif(trim(p_country), ''),
      timezone = coalesce(nullif(trim(p_timezone), ''), timezone),
      prefers_female_mentor = coalesce(p_prefers_female_mentor, false)
  where id = p_user;
end;
$$;
