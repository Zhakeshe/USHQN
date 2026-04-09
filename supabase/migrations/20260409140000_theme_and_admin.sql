-- user_settings is defined in 20260408140000_extras.sql; some DBs may lack it if only this file was run.
-- This block makes the migration safe: create base table if missing, then ensure theme columns.

create table if not exists public.user_settings (
  user_id                  uuid primary key references public.profiles(id) on delete cascade,
  notify_follows           boolean not null default true,
  notify_messages          boolean not null default true,
  notify_achievements      boolean not null default true,
  profile_public           boolean not null default true,
  show_in_people_search    boolean not null default true,
  updated_at               timestamptz not null default now()
);

alter table public.user_settings
  add column if not exists theme text not null default 'system'
    check (theme in ('light', 'dark', 'system')),
  add column if not exists reduce_motion boolean not null default false;

comment on column public.user_settings.theme is 'light | dark | system (follow OS)';
comment on column public.user_settings.reduce_motion is 'Minimize UI motion';

alter table public.user_settings enable row level security;

drop policy if exists "own settings" on public.user_settings;
create policy "own settings" on public.user_settings
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into public.user_settings (user_id)
  select id from public.profiles
  on conflict (user_id) do nothing;

create or replace function public.create_user_settings()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_settings (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_new_profile_settings on public.profiles;
create trigger on_new_profile_settings
  after insert on public.profiles
  for each row execute function public.create_user_settings();

-- Admin flag (set only via SQL dashboard or service role — not exposed to clients for write)
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

comment on column public.profiles.is_admin is 'Staff: access /admin dashboard. Grant: update profiles set is_admin=true where id=...';

-- Safe helper for RLS policies (avoids recursion)
create or replace function public.current_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid() limit 1),
    false
  );
$$;

grant execute on function public.current_is_admin() to authenticated;
