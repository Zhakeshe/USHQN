-- ─────────────────────────────────────────────────────────
-- 1. Username (@handle) on profiles
-- ─────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists username text;

-- enforce uniqueness case-insensitive (only when non-null)
create unique index if not exists profiles_username_lower_uq
  on public.profiles (lower(username))
  where username is not null;

-- allow only safe characters: lowercase letters, digits, underscore, 3-30 chars
alter table public.profiles
  drop constraint if exists profiles_username_format;
alter table public.profiles
  add constraint profiles_username_format
    check (
      username is null
      or (
        length(username) between 3 and 30
        and username ~ '^[a-z0-9_]+$'
      )
    );

-- ─────────────────────────────────────────────────────────
-- 2. Verified employer badge on profiles
-- ─────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists is_verified_employer boolean not null default false;

-- ─────────────────────────────────────────────────────────
-- 3. Job alerts: users subscribe to a filter, get a
--    notification when a new job matches
-- ─────────────────────────────────────────────────────────
create table if not exists public.job_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  employment_type text,   -- null = any; 'internship','fulltime','parttime','project'
  work_mode text,         -- null = any; 'remote','onsite','hybrid'
  sphere text,            -- null = any
  query_text text,        -- freetext keyword, null = any
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists job_alerts_user_idx on public.job_alerts (user_id);

alter table public.job_alerts enable row level security;

drop policy if exists job_alerts_select_own on public.job_alerts;
create policy job_alerts_select_own on public.job_alerts
  for select to authenticated using (user_id = auth.uid());

drop policy if exists job_alerts_insert_own on public.job_alerts;
create policy job_alerts_insert_own on public.job_alerts
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists job_alerts_update_own on public.job_alerts;
create policy job_alerts_update_own on public.job_alerts
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists job_alerts_delete_own on public.job_alerts;
create policy job_alerts_delete_own on public.job_alerts
  for delete to authenticated using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────
-- 4. Trigger: when a new job is inserted, notify matching
--    job_alert subscribers with an in-app notification
-- ─────────────────────────────────────────────────────────
create or replace function public.notify_job_alert_subscribers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  txt text;
begin
  for rec in
    select ja.user_id
    from public.job_alerts ja
    where ja.enabled = true
      and ja.user_id <> new.owner_id
      and (ja.employment_type is null or ja.employment_type = new.employment_type)
      and (ja.work_mode is null or ja.work_mode = new.work_mode)
      and (ja.sphere is null or ja.sphere = new.sphere)
      and (
        ja.query_text is null
        or new.title ilike '%' || ja.query_text || '%'
        or (new.description is not null and new.description ilike '%' || ja.query_text || '%')
      )
  loop
    txt := coalesce(new.title, 'Новая вакансия');
    insert into public.notifications (user_id, kind, title, body, link)
    values (
      rec.user_id,
      'job_alert',
      txt,
      'Сізге сәйкес жаңа вакансия жарияланды',
      '/jobs'
    )
    on conflict do nothing;
  end loop;
  return new;
end;
$$;

drop trigger if exists jobs_alert_notify_trigger on public.jobs;
create trigger jobs_alert_notify_trigger
after insert on public.jobs
for each row execute function public.notify_job_alert_subscribers();
