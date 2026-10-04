-- Supabase's admin API writes app_metadata after the auth.users insert trigger has run, so
-- handle_new_user() can miss the role. Keep the profile in sync when app_metadata changes.
-- Only the server (service role) can change app_metadata, so trusting it here is safe.
create function public.sync_profile_from_app_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.raw_app_meta_data ? 'role' then
    update public.profiles
    set role = (new.raw_app_meta_data ->> 'role')::public.app_role
    where id = new.id and role is distinct from (new.raw_app_meta_data ->> 'role')::public.app_role;
  end if;

  if new.raw_app_meta_data ? 'username' then
    update public.profiles
    set username = new.raw_app_meta_data ->> 'username'
    where id = new.id and username is distinct from new.raw_app_meta_data ->> 'username';
  end if;

  return new;
end;
$$;

create trigger on_auth_user_app_metadata_updated
  after update of raw_app_meta_data on auth.users
  for each row
  when (old.raw_app_meta_data is distinct from new.raw_app_meta_data)
  execute function public.sync_profile_from_app_metadata();
