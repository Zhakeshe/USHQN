-- Streaks, moderator role, chat read receipts + attachments, listing collections,
-- city/regional communities, mentorship requests; staff RLS for reports/audit.

-- ---------------------------------------------------------------------------
-- user_settings: ensure table (DBs that never ran 20260408140000_extras / theme)
-- ---------------------------------------------------------------------------
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
  add column if not exists theme text not null default 'system';

alter table public.user_settings
  add column if not exists reduce_motion boolean not null default false;

do $theme_chk$
begin
  alter table public.user_settings
    add constraint user_settings_theme_chk check (theme in ('light', 'dark', 'system'));
exception
  when duplicate_object then null;
end $theme_chk$;

alter table public.user_settings enable row level security;

drop policy if exists "own settings" on public.user_settings;
create policy "own settings" on public.user_settings
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into public.user_settings (user_id)
  select id from public.profiles
  on conflict (user_id) do nothing;

create or replace function public.create_user_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

comment on column public.user_settings.theme is 'light | dark | system (follow OS)';
comment on column public.user_settings.reduce_motion is 'Minimize UI motion';

-- ---------------------------------------------------------------------------
-- Profiles: streak + moderator (set by admin only)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_moderator boolean not null default false;

comment on column public.profiles.is_moderator is 'Moderation: reports queue + audit read. Grant via SQL like is_admin.';

alter table public.profiles
  add column if not exists activity_streak_count integer not null default 0;

alter table public.profiles
  add column if not exists activity_streak_last_utc date;

-- Daily streak bump (UTC calendar days); idempotent same-day.
create or replace function public.touch_activity_streak()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (timezone('utc', now()))::date;
  last_d date;
  cnt integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select p.activity_streak_last_utc, p.activity_streak_count
  into last_d, cnt
  from public.profiles p
  where p.id = auth.uid();

  if not found then
    raise exception 'profile not found';
  end if;

  if last_d = today then
    return;
  end if;

  if last_d is null then
    update public.profiles
    set activity_streak_last_utc = today,
        activity_streak_count = 1
    where id = auth.uid();
    return;
  end if;

  if last_d = today - 1 then
    update public.profiles
    set activity_streak_last_utc = today,
        activity_streak_count = cnt + 1
    where id = auth.uid();
  else
    update public.profiles
    set activity_streak_last_utc = today,
        activity_streak_count = 1
    where id = auth.uid();
  end if;
end;
$$;

grant execute on function public.touch_activity_streak() to authenticated;

-- ---------------------------------------------------------------------------
-- Staff helpers
-- ---------------------------------------------------------------------------
create or replace function public.current_is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_moderator from public.profiles where id = auth.uid() limit 1),
    false
  );
$$;

grant execute on function public.current_is_moderator() to authenticated;

create or replace function public.current_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_is_admin() or public.current_is_moderator();
$$;

grant execute on function public.current_is_staff() to authenticated;

-- Block self-service changes to is_moderator (admins only)
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
     or new.is_moderator is distinct from old.is_moderator
     or new.org_verified is distinct from old.org_verified
     or new.is_banned is distinct from old.is_banned then
    raise exception 'Only staff can change admin, moderator, verification, or ban flags';
  end if;
  return new;
end;
$$;

-- Audit moderator flag changes
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
  if old.is_moderator is distinct from new.is_moderator then
    insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
    values (
      auth.uid(),
      'profiles.is_moderator_changed',
      'profile',
      new.id,
      jsonb_build_object('before', old.is_moderator, 'after', new.is_moderator)
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

-- ---------------------------------------------------------------------------
-- Moderation policies: staff sees all reports; staff can resolve
-- ---------------------------------------------------------------------------
drop policy if exists content_reports_select on public.content_reports;
create policy content_reports_select on public.content_reports
  for select to authenticated using (
    reporter_id = auth.uid()
    or public.current_is_admin()
    or public.current_is_moderator()
  );

drop policy if exists content_reports_admin_update on public.content_reports;
create policy content_reports_staff_update on public.content_reports
  for update to authenticated
  using (public.current_is_staff())
  with check (public.current_is_staff());

-- ---------------------------------------------------------------------------
-- Audit log: moderators read-only
-- ---------------------------------------------------------------------------
drop policy if exists audit_log_select_admin on public.audit_log;
create policy audit_log_select_staff on public.audit_log
  for select to authenticated using (public.current_is_staff());

-- ---------------------------------------------------------------------------
-- User settings: digest email + push opt-in (backend delivery optional)
-- (table ensured at top of this file)
-- ---------------------------------------------------------------------------
alter table public.user_settings
  add column if not exists digest_email_enabled boolean not null default true;

alter table public.user_settings
  add column if not exists push_notify_opt_in boolean not null default false;

comment on column public.user_settings.digest_email_enabled is 'Opt-in for periodic digest emails (cron uses this).';
comment on column public.user_settings.push_notify_opt_in is 'User consent for future web push; not wired until push lands.';

-- ---------------------------------------------------------------------------
-- Showcase collections
-- ---------------------------------------------------------------------------
alter table public.listings
  add column if not exists collection_slug text;

create index if not exists listings_collection_slug_idx
  on public.listings (collection_slug)
  where collection_slug is not null and length(trim(collection_slug)) > 0;

-- ---------------------------------------------------------------------------
-- Chat: read cursor + attachments
-- ---------------------------------------------------------------------------
alter table public.conversation_participants
  add column if not exists last_read_at timestamptz;

alter table public.messages
  alter column body drop not null;

alter table public.messages
  add column if not exists attachment_url text;

alter table public.messages
  add column if not exists attachment_name text;

alter table public.messages drop constraint if exists messages_body_or_attachment_chk;

alter table public.messages
  add constraint messages_body_or_attachment_chk check (
    (body is not null and length(trim(body)) > 0)
    or (attachment_url is not null and length(trim(attachment_url)) > 0)
  );

drop policy if exists conv_part_update_own on public.conversation_participants;
create policy conv_part_update_own on public.conversation_participants
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

do $pub$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'conversation_participants'
  ) then
    alter publication supabase_realtime add table public.conversation_participants;
  end if;
end $pub$;

-- ---------------------------------------------------------------------------
-- Communities (city / regional groups)
-- ---------------------------------------------------------------------------
create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  region_label text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

alter table public.communities enable row level security;
alter table public.community_members enable row level security;

drop policy if exists communities_select on public.communities;
create policy communities_select on public.communities
  for select to authenticated using (true);

drop policy if exists community_members_select on public.community_members;
create policy community_members_select on public.community_members
  for select to authenticated using (true);

drop policy if exists community_members_insert_self on public.community_members;
create policy community_members_insert_self on public.community_members
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists community_members_delete_self on public.community_members;
create policy community_members_delete_self on public.community_members
  for delete to authenticated using (user_id = auth.uid());

insert into public.communities (slug, title, region_label) values
  ('almaty', 'USHQN · Алматы', 'Қазақстан'),
  ('astana', 'USHQN · Астана', 'Қазақстан'),
  ('shymkent', 'USHQN · Шымкент', 'Қазақстан'),
  ('online', 'Онлайн қауапы', 'Кез келген жер')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Mentorship requests (mentee → mentor)
-- ---------------------------------------------------------------------------
create table if not exists public.mentorship_requests (
  id uuid primary key default gen_random_uuid(),
  mentee_id uuid not null references public.profiles(id) on delete cascade,
  mentor_id uuid not null references public.profiles(id) on delete cascade,
  note text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  check (mentee_id <> mentor_id)
);

create unique index if not exists mentorship_one_pending_per_pair_idx
  on public.mentorship_requests (mentee_id, mentor_id)
  where status = 'pending';

create index if not exists mentorship_mentor_idx on public.mentorship_requests (mentor_id, created_at desc);
create index if not exists mentorship_mentee_idx on public.mentorship_requests (mentee_id, created_at desc);

alter table public.mentorship_requests enable row level security;

drop policy if exists mentorship_select on public.mentorship_requests;
create policy mentorship_select on public.mentorship_requests
  for select to authenticated using (
    mentee_id = auth.uid()
    or mentor_id = auth.uid()
    or public.current_is_admin()
  );

drop policy if exists mentorship_insert on public.mentorship_requests;
create policy mentorship_insert on public.mentorship_requests
  for insert to authenticated with check (mentee_id = auth.uid());

drop policy if exists mentorship_update on public.mentorship_requests;
create policy mentorship_update on public.mentorship_requests
  for update to authenticated
  using (mentor_id = auth.uid() or mentee_id = auth.uid())
  with check (mentor_id = auth.uid() or mentee_id = auth.uid());
