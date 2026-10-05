-- Admin operations that need columns ordinary users can't edit (role, username, birth year)
-- or that happen outside the database (auth changes). Running them as the signed-in admin keeps
-- auth.uid() set, so the audit log records which admin did it.

-- Admins edit any profile field through this function (column grants block direct updates).
create function public.admin_update_profile(
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

-- Records admin actions that happen outside these tables (password resets, email changes,
-- account deactivation, deletions), attributed to the signed-in admin.
create function public.log_admin_action(p_action text, p_entity text, p_entity_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id)
  values (auth.uid(), left(p_action, 60), left(p_entity, 60), p_entity_id);
end;
$$;

revoke execute on function public.admin_update_profile(uuid, text, public.app_role, text, int, text, text, boolean) from anon;
revoke execute on function public.log_admin_action(text, text, uuid) from anon;
