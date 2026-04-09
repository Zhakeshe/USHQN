-- Prevent non-admin users from escalating privileges via profiles.is_admin.
create or replace function public.protect_admin_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin is distinct from old.is_admin then
    if not public.current_is_admin() then
      raise exception 'Only admins can change is_admin';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_admin_flag_trigger on public.profiles;
create trigger protect_admin_flag_trigger
before update on public.profiles
for each row execute function public.protect_admin_flag();
