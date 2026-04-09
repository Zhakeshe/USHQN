-- Growth: referrals, onboarding bonus, featured jobs
-- Trust: org verification, recommendations, content reports, audit log
-- Moderation: ban flag, admin policies, message rate limit

-- ---------------------------------------------------------------------------
-- Profiles: referral, onboarding skip, verification, ban
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists referred_by uuid references public.profiles(id) on delete set null;

alter table public.profiles
  add column if not exists onboarding_bonus_claimed boolean not null default false;

alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

alter table public.profiles
  add column if not exists onboarding_dismissed_at timestamptz;

alter table public.profiles
  add column if not exists org_verified boolean not null default false;

alter table public.profiles
  add column if not exists is_banned boolean not null default false;

comment on column public.profiles.referred_by is 'Optional profile id that referred this user (set from auth metadata at signup).';
comment on column public.profiles.org_verified is 'Staff-verified school/organization; show badge on profile.';
comment on column public.profiles.is_banned is 'Suspended accounts; app should block access for true.';

-- ---------------------------------------------------------------------------
-- Jobs: featured (admin-managed “monetization” placeholder)
-- ---------------------------------------------------------------------------
alter table public.jobs
  add column if not exists is_featured boolean not null default false;

alter table public.jobs
  add column if not exists featured_until timestamptz;

comment on column public.jobs.is_featured is 'Pinned in listings when featured_until is in the future.';
comment on column public.jobs.featured_until is 'End of featured promotion; admins set via dashboard.';

-- ---------------------------------------------------------------------------
-- Recommendations (short public endorsements)
-- ---------------------------------------------------------------------------
create table if not exists public.profile_recommendations (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.profiles(id) on delete cascade,
  body text not null
    check (char_length(trim(body)) > 0 and char_length(body) <= 500),
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  check (author_id <> subject_id),
  unique (author_id, subject_id)
);

alter table public.profile_recommendations enable row level security;

create policy profile_recommendations_select on public.profile_recommendations
  for select to authenticated using (
    is_public
    or author_id = auth.uid()
    or subject_id = auth.uid()
    or public.current_is_admin()
  );

create policy profile_recommendations_insert on public.profile_recommendations
  for insert to authenticated with check (author_id = auth.uid());

create policy profile_recommendations_update_own on public.profile_recommendations
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy profile_recommendations_delete_own on public.profile_recommendations
  for delete to authenticated using (author_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Content reports (moderation queue)
-- ---------------------------------------------------------------------------
create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null
    check (target_type in ('job', 'achievement', 'message', 'listing', 'profile')),
  target_id uuid not null,
  reason text,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null
);

create index if not exists content_reports_status_created_idx
  on public.content_reports (status, created_at desc);

alter table public.content_reports enable row level security;

create policy content_reports_insert on public.content_reports
  for insert to authenticated with check (reporter_id = auth.uid());

create policy content_reports_select on public.content_reports
  for select to authenticated using (
    reporter_id = auth.uid()
    or public.current_is_admin()
  );

create policy content_reports_admin_update on public.content_reports
  for update to authenticated using (public.current_is_admin()) with check (public.current_is_admin());

-- ---------------------------------------------------------------------------
-- Audit log (admin-readable; rows inserted by triggers only)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;

create policy audit_log_select_admin on public.audit_log
  for select to authenticated using (public.current_is_admin());

-- ---------------------------------------------------------------------------
-- Auth: capture referral in metadata + extend new-user handler
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  referred_by_val uuid;
begin
  referred_by_val := null;
  if new.raw_user_meta_data ? 'referred_by' then
    begin
      referred_by_val := (nullif(trim(new.raw_user_meta_data->>'referred_by'), ''))::uuid;
      if referred_by_val is not null and referred_by_val = new.id then
        referred_by_val := null;
      end if;
      if referred_by_val is not null and not exists (select 1 from public.profiles where id = referred_by_val) then
        referred_by_val := null;
      end if;
    exception when others then
      referred_by_val := null;
    end;
  end if;

  insert into public.profiles (id, display_name, role, referred_by)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    case
      when new.raw_user_meta_data->>'role' in ('pupil', 'student', 'parent')
      then (new.raw_user_meta_data->>'role')::public.user_role
      else 'student'::public.user_role
    end,
    referred_by_val
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileged profile fields: only admins may change is_admin, org_verified, is_banned
-- (replaces narrow protect_admin_flag from earlier migration)
-- ---------------------------------------------------------------------------
drop trigger if exists protect_admin_flag_trigger on public.profiles;
drop function if exists public.protect_admin_flag();

create or replace function public.protect_privileged_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_is_admin() then
    return new;
  end if;
  if new.is_admin is distinct from old.is_admin
     or new.org_verified is distinct from old.org_verified
     or new.is_banned is distinct from old.is_banned then
    raise exception 'Only staff can change admin, verification, or ban flags';
  end if;
  return new;
end;
$$;

create trigger protect_privileged_profile_fields_trigger
before update on public.profiles
for each row execute function public.protect_privileged_profile_fields();

-- ---------------------------------------------------------------------------
-- Job featured flags: only admins can change
-- ---------------------------------------------------------------------------
create or replace function public.protect_job_feature_flags()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_is_admin() then
    return new;
  end if;
  if new.is_featured is distinct from old.is_featured
     or new.featured_until is distinct from old.featured_until then
    raise exception 'Only staff can change featured job settings';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_job_feature_flags_trigger on public.jobs;
create trigger protect_job_feature_flags_trigger
before update on public.jobs
for each row execute function public.protect_job_feature_flags();

-- ---------------------------------------------------------------------------
-- Admin may update any profile / any job (moderation)
-- ---------------------------------------------------------------------------
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
  for update to authenticated using (public.current_is_admin()) with check (public.current_is_admin());

drop policy if exists jobs_admin_update on public.jobs;
create policy jobs_admin_update on public.jobs
  for update to authenticated using (public.current_is_admin()) with check (public.current_is_admin());

-- ---------------------------------------------------------------------------
-- Audit triggers (after update, when actor is admin)
-- ---------------------------------------------------------------------------
create or replace function public.audit_profile_staff_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_is_admin() then
    return new;
  end if;
  if old.is_admin is distinct from new.is_admin then
    insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
    values (
      auth.uid(),
      'profiles.is_admin_changed',
      'profile',
      new.id,
      jsonb_build_object('before', old.is_admin, 'after', new.is_admin)
    );
  end if;
  if old.org_verified is distinct from new.org_verified then
    insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
    values (
      auth.uid(),
      'profiles.org_verified_changed',
      'profile',
      new.id,
      jsonb_build_object('before', old.org_verified, 'after', new.org_verified)
    );
  end if;
  if old.is_banned is distinct from new.is_banned then
    insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
    values (
      auth.uid(),
      'profiles.is_banned_changed',
      'profile',
      new.id,
      jsonb_build_object('before', old.is_banned, 'after', new.is_banned)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_profile_staff_fields_trigger on public.profiles;
create trigger audit_profile_staff_fields_trigger
after update on public.profiles
for each row execute function public.audit_profile_staff_fields();

create or replace function public.audit_jobs_featured_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_is_admin() then
    return new;
  end if;
  if old.is_featured is distinct from new.is_featured
     or old.featured_until is distinct from new.featured_until then
    insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
    values (
      auth.uid(),
      'jobs.feature_flags_changed',
      'job',
      new.id,
      jsonb_build_object(
        'is_featured', jsonb_build_object('before', old.is_featured, 'after', new.is_featured),
        'featured_until', jsonb_build_object('before', old.featured_until, 'after', new.featured_until)
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_jobs_featured_changed_trigger on public.jobs;
create trigger audit_jobs_featured_changed_trigger
after update on public.jobs
for each row execute function public.audit_jobs_featured_changed();

-- ---------------------------------------------------------------------------
-- Message anti-spam (simple sliding window)
-- ---------------------------------------------------------------------------
create or replace function public.enforce_message_rate_limit()
returns trigger
language plpgsql
as $$
declare
  c integer;
begin
  select count(*)::integer into c
  from public.messages
  where sender_id = new.sender_id
    and created_at > now() - interval '1 minute';

  if c >= 30 then
    raise exception 'Too many messages from this account in a short window. Try again in a minute.';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_rate_limit_trigger on public.messages;
create trigger messages_rate_limit_trigger
before insert on public.messages
for each row execute function public.enforce_message_rate_limit();

-- ---------------------------------------------------------------------------
-- Onboarding bonus (+50 points in “other” category)
-- ---------------------------------------------------------------------------
create or replace function public.claim_onboarding_bonus()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cat_id uuid;
  prof record;
begin
  select * into prof from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Not authenticated';
  end if;
  if prof.is_banned then
    raise exception 'Account suspended';
  end if;
  if prof.onboarding_bonus_claimed then
    return;
  end if;
  if prof.headline is null or trim(prof.headline) = ''
     or prof.location is null or trim(prof.location) = '' then
    raise exception 'Complete your profile headline and location first';
  end if;
  if not exists (select 1 from public.achievements where user_id = auth.uid()) then
    raise exception 'Add at least one achievement first';
  end if;
  if not exists (select 1 from public.profile_interests where user_id = auth.uid()) then
    raise exception 'Pick at least one interest first';
  end if;

  select id into cat_id from public.achievement_categories where slug = 'other' limit 1;
  if cat_id is null then
    raise exception 'Missing achievement category';
  end if;

  insert into public.user_category_scores (user_id, category_id, points)
  values (auth.uid(), cat_id, 50)
  on conflict (user_id, category_id)
  do update set points = public.user_category_scores.points + excluded.points;

  update public.profiles
  set onboarding_bonus_claimed = true,
      onboarding_completed_at = now()
  where id = auth.uid();
end;
$$;

grant execute on function public.claim_onboarding_bonus() to authenticated;
