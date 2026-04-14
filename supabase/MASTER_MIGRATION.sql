-- USHQN MASTER MIGRATION (all in order)
-- Run this in Supabase SQL Editor

-- ==================== 20260408120000_init.sql ====================
-- USHQN MVP schema + RLS + storage + realtime helpers

-- Extensions
create extension if not exists "pgcrypto";

-- Enums
create type public.user_role as enum ('pupil', 'student', 'parent');
create type public.listing_kind as enum ('good', 'service');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  role public.user_role not null default 'student',
  display_name text not null default '',
  location text,
  headline text,
  school_or_org text,
  is_employer boolean not null default false,
  avatar_url text,
  banner_url text
);

create table public.profile_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  skill text not null,
  created_at timestamptz not null default now()
);

create unique index profile_skills_user_skill_ci
  on public.profile_skills (user_id, lower(skill));

create table public.achievement_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label_ru text not null,
  default_points integer not null default 10
);

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid not null references public.achievement_categories (id),
  title text not null,
  description text,
  file_path text,
  points_awarded integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_category_scores (
  user_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid not null references public.achievement_categories (id),
  points integer not null default 0,
  primary key (user_id, category_id)
);

create table public.listings (
  id uuid primary key default gen_random_uuid (),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  kind public.listing_kind not null default 'good',
  title text not null,
  description text,
  price_text text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  format_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.interests (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label_ru text not null
);

create table public.profile_interests (
  user_id uuid not null references public.profiles (id) on delete cascade,
  interest_id uuid not null references public.interests (id) on delete cascade,
  primary key (user_id, interest_id)
);

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location_text text,
  is_online boolean not null default false,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

-- Seed categories
insert into public.achievement_categories (slug, label_ru, default_points) values
  ('robotics', 'Ð Ð¾Ð±Ð¾Ñ‚Ð¾Ñ‚ÐµÑ…Ð½Ð¸ÐºÐ°', 15),
  ('programming', 'ÐŸÑ€Ð¾Ð³Ñ€Ð°Ð¼Ð¼Ð¸Ñ€Ð¾Ð²Ð°Ð½Ð¸Ðµ', 15),
  ('sports', 'Ð¡Ð¿Ð¾Ñ€Ñ‚', 10),
  ('debates', 'Ð”ÐµÐ±Ð°Ñ‚Ñ‹', 12),
  ('science', 'ÐÐ°ÑƒÐºÐ°', 12),
  ('arts', 'Ð˜ÑÐºÑƒÑÑÑ‚Ð²Ð¾', 10),
  ('other', 'Ð”Ñ€ÑƒÐ³Ð¾Ðµ', 8);

insert into public.interests (slug, label_ru) values
  ('robotics', 'Ð Ð¾Ð±Ð¾Ñ‚Ð¾Ñ‚ÐµÑ…Ð½Ð¸ÐºÐ°'),
  ('programming', 'ÐŸÑ€Ð¾Ð³Ñ€Ð°Ð¼Ð¼Ð¸Ñ€Ð¾Ð²Ð°Ð½Ð¸Ðµ'),
  ('sport', 'Ð¡Ð¿Ð¾Ñ€Ñ‚'),
  ('debates', 'Ð”ÐµÐ±Ð°Ñ‚Ñ‹'),
  ('mentor', 'ÐÐ°ÑÑ‚Ð°Ð²Ð½Ð¸Ñ‡ÐµÑÑ‚Ð²Ð¾'),
  ('startup', 'Ð¡Ñ‚Ð°Ñ€Ñ‚Ð°Ð¿Ñ‹'),
  ('olympiads', 'ÐžÐ»Ð¸Ð¼Ð¿Ð¸Ð°Ð´Ñ‹'),
  ('volunteering', 'Ð’Ð¾Ð»Ð¾Ð½Ñ‚Ñ‘Ñ€ÑÑ‚Ð²Ð¾');

-- Triggers: new user profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    case
      when new.raw_user_meta_data->>'role' in ('pupil', 'student', 'parent')
      then (new.raw_user_meta_data->>'role')::public.user_role
      else 'student'::public.user_role
    end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger achievements_updated_at before update on public.achievements
  for each row execute function public.set_updated_at();

create trigger listings_updated_at before update on public.listings
  for each row execute function public.set_updated_at();

create trigger jobs_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();

-- Achievement points: set points_awarded from category default on insert
create or replace function public.achievement_set_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dp integer;
begin
  select default_points into dp from public.achievement_categories where id = new.category_id;
  new.points_awarded = coalesce(dp, 10);
  return new;
end;
$$;

create trigger achievement_set_points_trigger
  before insert on public.achievements
  for each row execute function public.achievement_set_points();

-- Bump score on achievement insert
create or replace function public.achievement_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_category_scores (user_id, category_id, points)
  values (new.user_id, new.category_id, new.points_awarded)
  on conflict (user_id, category_id)
  do update set points = public.user_category_scores.points + excluded.points;
  return new;
end;
$$;

create trigger achievement_after_insert_trigger
  after insert on public.achievements
  for each row execute function public.achievement_after_insert();

create or replace function public.achievement_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.user_category_scores
    set points = greatest(0, points - old.points_awarded)
    where user_id = old.user_id and category_id = old.category_id;
  return old;
end;
$$;

create trigger achievement_after_delete_trigger
  after delete on public.achievements
  for each row execute function public.achievement_after_delete();

-- DM helper
create or replace function public.get_or_create_dm(other_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conv_id uuid;
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not authenticated';
  end if;
  if other_id = me then
    raise exception 'invalid peer';
  end if;

  select c.id into conv_id
  from public.conversations c
  where (
    select count(*) from public.conversation_participants p where p.conversation_id = c.id
  ) = 2
  and exists (
    select 1 from public.conversation_participants p
    where p.conversation_id = c.id and p.user_id = me
  )
  and exists (
    select 1 from public.conversation_participants p
    where p.conversation_id = c.id and p.user_id = other_id
  )
  limit 1;

  if conv_id is null then
    insert into public.conversations default values returning id into conv_id;
    insert into public.conversation_participants (conversation_id, user_id) values
      (conv_id, me),
      (conv_id, other_id);
  end if;

  return conv_id;
end;
$$;

grant execute on function public.get_or_create_dm(uuid) to authenticated;

-- RLS
alter table public.profiles enable row level security;
alter table public.profile_skills enable row level security;
alter table public.achievement_categories enable row level security;
alter table public.achievements enable row level security;
alter table public.user_category_scores enable row level security;
alter table public.listings enable row level security;
alter table public.jobs enable row level security;
alter table public.interests enable row level security;
alter table public.profile_interests enable row level security;
alter table public.follows enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.events enable row level security;

-- Profiles: readable by authenticated; update own
create policy profiles_select_authenticated on public.profiles
  for select to authenticated using (true);

create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Skills
create policy skills_select on public.profile_skills
  for select to authenticated using (true);

create policy skills_insert_own on public.profile_skills
  for insert to authenticated with check (user_id = auth.uid());

create policy skills_delete_own on public.profile_skills
  for delete to authenticated using (user_id = auth.uid());

-- Categories & interests (read-only for users)
create policy categories_read on public.achievement_categories
  for select to authenticated using (true);

create policy interests_read on public.interests
  for select to authenticated using (true);

-- Achievements
create policy achievements_select on public.achievements
  for select to authenticated using (true);

create policy achievements_insert_own on public.achievements
  for insert to authenticated with check (user_id = auth.uid());

create policy achievements_update_own on public.achievements
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy achievements_delete_own on public.achievements
  for delete to authenticated using (user_id = auth.uid());

-- Scores
create policy scores_select on public.user_category_scores
  for select to authenticated using (true);

-- Listings
create policy listings_select on public.listings
  for select to authenticated using (true);

create policy listings_insert_own on public.listings
  for insert to authenticated with check (owner_id = auth.uid());

create policy listings_update_own on public.listings
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy listings_delete_own on public.listings
  for delete to authenticated using (owner_id = auth.uid());

-- Jobs
create policy jobs_select on public.jobs
  for select to authenticated using (true);

create policy jobs_insert_own on public.jobs
  for insert to authenticated with check (owner_id = auth.uid());

create policy jobs_update_own on public.jobs
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy jobs_delete_own on public.jobs
  for delete to authenticated using (owner_id = auth.uid());

-- Profile interests
create policy pi_select on public.profile_interests
  for select to authenticated using (true);

create policy pi_insert_own on public.profile_interests
  for insert to authenticated with check (user_id = auth.uid());

create policy pi_delete_own on public.profile_interests
  for delete to authenticated using (user_id = auth.uid());

-- Follows
create policy follows_select on public.follows
  for select to authenticated using (true);

create policy follows_insert_own on public.follows
  for insert to authenticated with check (follower_id = auth.uid());

create policy follows_delete_own on public.follows
  for delete to authenticated using (follower_id = auth.uid());

-- Conversations: visible if participant
create policy conv_select_participant on public.conversations
  for select to authenticated using (
    exists (
      select 1 from public.conversation_participants p
      where p.conversation_id = id and p.user_id = auth.uid()
    )
  );

create policy conv_part_select on public.conversation_participants
  for select to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1 from public.conversation_participants p
      where p.conversation_id = conversation_participants.conversation_id
        and p.user_id = auth.uid()
    )
  );

-- Only system inserts participants via get_or_create_dm (security definer) â€” allow insert for self when creating? 
-- get_or_create_dm runs as definer so it bypasses RLS. We need policy for service? Actually SECURITY DEFINER bypasses RLS on participant insert.
-- For reads, conv_part_select covers listing other participant in same conversation.

-- Messages
create policy messages_select on public.messages
  for select to authenticated using (
    exists (
      select 1 from public.conversation_participants p
      where p.conversation_id = messages.conversation_id and p.user_id = auth.uid()
    )
  );

create policy messages_insert on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversation_participants p
      where p.conversation_id = messages.conversation_id and p.user_id = auth.uid()
    )
  );

-- Events: public events readable; all own events readable
create policy events_select on public.events
  for select to authenticated using (
    is_public = true or owner_id = auth.uid()
  );

create policy events_insert_own on public.events
  for insert to authenticated with check (owner_id = auth.uid());

create policy events_update_own on public.events
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy events_delete_own on public.events
  for delete to authenticated using (owner_id = auth.uid());

-- Storage bucket
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do nothing;

-- Storage RLS: users manage files under folder named their uid
create policy uploads_select on storage.objects
  for select to authenticated using (bucket_id = 'uploads');

create policy uploads_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy uploads_update on storage.objects
  for update to authenticated using (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy uploads_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Realtime for messages
alter publication supabase_realtime add table public.messages;


-- ==================== 20260408130000_notifications.sql ====================
-- ============================================================
-- Notifications system
-- ============================================================

create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  actor_id      uuid references public.profiles(id) on delete set null,
  kind          text not null,  -- 'follow' | 'message' | 'achievement_like' | 'system'
  title         text not null,
  body          text,
  link          text,
  is_read       boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications(user_id, created_at desc);

-- RLS
alter table public.notifications enable row level security;

create policy "users see own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "system can insert notifications"
  on public.notifications for insert
  with check (true);

create policy "users can mark own notifications read"
  on public.notifications for update
  using (auth.uid() = user_id);

create policy "users can delete own notifications"
  on public.notifications for delete
  using (auth.uid() = user_id);

-- ============================================================
-- Trigger: notify on new follow
-- ============================================================
create or replace function public.notify_on_follow()
returns trigger language plpgsql security definer as $$
declare
  actor_name text;
begin
  select display_name into actor_name from public.profiles where id = new.follower_id;
  insert into public.notifications(user_id, actor_id, kind, title, body, link)
  values (
    new.following_id,
    new.follower_id,
    'follow',
    'ÐÐ¾Ð²Ñ‹Ð¹ Ð¿Ð¾Ð´Ð¿Ð¸ÑÑ‡Ð¸Ðº',
    coalesce(actor_name, 'ÐŸÐ¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»ÑŒ') || ' Ð¿Ð¾Ð´Ð¿Ð¸ÑÐ°Ð»ÑÑ Ð½Ð° Ð²Ð°Ñ',
    '/u/' || new.follower_id::text
  );
  return new;
end;
$$;

drop trigger if exists on_new_follow on public.follows;
create trigger on_new_follow
  after insert on public.follows
  for each row execute function public.notify_on_follow();

-- ============================================================
-- Trigger: notify on new message
-- ============================================================
create or replace function public.notify_on_message()
returns trigger language plpgsql security definer as $$
declare
  sender_name text;
  recipient_id uuid;
begin
  select display_name into sender_name from public.profiles where id = new.sender_id;

  -- find the other participant
  select user_id into recipient_id
    from public.conversation_participants
   where conversation_id = new.conversation_id
     and user_id <> new.sender_id
   limit 1;

  if recipient_id is null then
    return new;
  end if;

  insert into public.notifications(user_id, actor_id, kind, title, body, link)
  values (
    recipient_id,
    new.sender_id,
    'message',
    'ÐÐ¾Ð²Ð¾Ðµ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ',
    coalesce(sender_name, 'ÐŸÐ¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»ÑŒ') || ': ' || left(new.body, 80),
    '/chat/' || new.conversation_id::text
  );
  return new;
end;
$$;

drop trigger if exists on_new_message on public.messages;
create trigger on_new_message
  after insert on public.messages
  for each row execute function public.notify_on_message();

-- ============================================================
-- Trigger: notify on new achievement (confirm)
-- ============================================================
create or replace function public.notify_on_achievement()
returns trigger language plpgsql security definer as $$
begin
  insert into public.notifications(user_id, actor_id, kind, title, body, link)
  values (
    new.user_id,
    null,
    'system',
    'ðŸ† Ð”Ð¾ÑÑ‚Ð¸Ð¶ÐµÐ½Ð¸Ðµ Ð´Ð¾Ð±Ð°Ð²Ð»ÐµÐ½Ð¾',
    'Ð’Ñ‹ Ð´Ð¾Ð±Ð°Ð²Ð¸Ð»Ð¸: ' || new.title,
    '/achievements'
  );
  return new;
end;
$$;

drop trigger if exists on_new_achievement on public.achievements;
create trigger on_new_achievement
  after insert on public.achievements
  for each row execute function public.notify_on_achievement();


-- ==================== 20260408140000_extras.sql ====================
-- ============================================================
-- Extra columns on profiles: bio + social links
-- ============================================================
alter table public.profiles
  add column if not exists bio            text,
  add column if not exists github_url     text,
  add column if not exists telegram_url   text,
  add column if not exists linkedin_url   text,
  add column if not exists website_url    text,
  add column if not exists profile_views  integer not null default 0;

-- ============================================================
-- Bookmarks (jobs / listings / events)
-- ============================================================
create table if not exists public.bookmarks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  target_type text not null,   -- 'job' | 'listing' | 'event'
  target_id   uuid not null,
  created_at  timestamptz not null default now(),
  unique(user_id, target_type, target_id)
);
alter table public.bookmarks enable row level security;
create policy "own bookmarks" on public.bookmarks
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- Achievement likes
-- ============================================================
create table if not exists public.achievement_likes (
  user_id        uuid not null references public.profiles(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (user_id, achievement_id)
);
alter table public.achievement_likes enable row level security;
create policy "own likes" on public.achievement_likes
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "read likes" on public.achievement_likes for select using (true);

-- ============================================================
-- Event RSVPs
-- ============================================================
create table if not exists public.event_rsvps (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  event_id   uuid not null references public.events(id) on delete cascade,
  status     text not null default 'going', -- 'going' | 'maybe' | 'not_going'
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
alter table public.event_rsvps enable row level security;
create policy "own rsvp" on public.event_rsvps
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "read rsvps" on public.event_rsvps for select using (true);

-- ============================================================
-- Job applications
-- ============================================================
create table if not exists public.job_applications (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs(id) on delete cascade,
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  cover_note  text,
  status      text not null default 'pending', -- 'pending' | 'viewed' | 'accepted' | 'declined'
  created_at  timestamptz not null default now(),
  unique(job_id, applicant_id)
);
alter table public.job_applications enable row level security;
create policy "own applications" on public.job_applications
  using (auth.uid() = applicant_id) with check (auth.uid() = applicant_id);
create policy "job owners see applications" on public.job_applications for select
  using (
    auth.uid() = applicant_id
    or auth.uid() = (select owner_id from public.jobs where id = job_id)
  );

-- ============================================================
-- User settings
-- ============================================================
create table if not exists public.user_settings (
  user_id                  uuid primary key references public.profiles(id) on delete cascade,
  notify_follows           boolean not null default true,
  notify_messages          boolean not null default true,
  notify_achievements      boolean not null default true,
  profile_public           boolean not null default true,
  show_in_people_search    boolean not null default true,
  updated_at               timestamptz not null default now()
);
alter table public.user_settings enable row level security;
create policy "own settings" on public.user_settings
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Insert default settings for existing users
insert into public.user_settings (user_id)
  select id from public.profiles
  on conflict (user_id) do nothing;

-- Trigger: create settings for new user
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

-- ============================================================
-- Helper: increment profile views
-- ============================================================
create or replace function public.increment_profile_views(profile_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.profiles set profile_views = profile_views + 1 where id = profile_id;
end;
$$;


-- ==================== 20260409120000_profile_accent.sql ====================
-- Profile accent (Discord-style banner trim / theme color)
alter table public.profiles
  add column if not exists accent_color text;

comment on column public.profiles.accent_color is 'Hex color e.g. #5865F2 for profile accent when no banner image';


-- ==================== 20260409140000_theme_and_admin.sql ====================
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

-- Admin flag (set only via SQL dashboard or service role â€” not exposed to clients for write)
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


-- ==================== 20260409170000_admin_security_hardening.sql ====================
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


-- ==================== 20260409190000_growth_trust_moderation.sql ====================
-- Growth: referrals, onboarding bonus, featured jobs
-- Trust: org verification, recommendations, content reports, audit log
-- Moderation: ban flag, admin policies, message rate limit

-- ---------------------------------------------------------------------------
-- Admin helper (same as 20260409140000_theme_and_admin.sql â€” required here if
-- that migration was skipped or this file is pasted alone into the SQL editor)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

comment on column public.profiles.is_admin is 'Staff: access /admin dashboard. Grant: update profiles set is_admin=true where id=...';

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
-- Jobs: featured (admin-managed â€œmonetizationâ€ placeholder)
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
-- Onboarding bonus (+50 points in â€œotherâ€ category)
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


-- ==================== 20260409200000_jobs_applications_portfolio_onboarding.sql ====================
-- Job applications & pipeline (status), work mode, company privacy, portfolio links,
-- onboarding snooze + stricter bonus criteria (profile depth + first action).

-- ---------------------------------------------------------------------------
-- Job application status + table
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.job_application_status AS ENUM (
    'submitted', 'viewed', 'replied', 'test_task', 'interview', 'accepted', 'rejected', 'withdrawn'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  applicant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.job_application_status NOT NULL DEFAULT 'submitted',
  cv_url text,
  portfolio_url text,
  interview_slot timestamptz,
  owner_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, applicant_id)
);

CREATE INDEX IF NOT EXISTS job_applications_job_idx ON public.job_applications(job_id);
CREATE INDEX IF NOT EXISTS job_applications_applicant_idx ON public.job_applications(applicant_id);

DROP TRIGGER IF EXISTS job_applications_updated_at ON public.job_applications;
CREATE TRIGGER job_applications_updated_at
  BEFORE UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS job_app_select ON public.job_applications;
CREATE POLICY job_app_select ON public.job_applications
  FOR SELECT TO authenticated
  USING (
    applicant_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.owner_id = auth.uid())
    OR public.current_is_admin()
  );

DROP POLICY IF EXISTS job_app_insert ON public.job_applications;
CREATE POLICY job_app_insert ON public.job_applications
  FOR INSERT TO authenticated
  WITH CHECK (
    applicant_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_id AND j.owner_id IS DISTINCT FROM auth.uid()
    )
  );

DROP POLICY IF EXISTS job_app_update ON public.job_applications;
CREATE POLICY job_app_update ON public.job_applications
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.owner_id = auth.uid())
    OR public.current_is_admin()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.owner_id = auth.uid())
    OR public.current_is_admin()
  );

-- ---------------------------------------------------------------------------
-- Jobs: work mode & optional company (hidden until applicant â€” enforced in app)
-- ---------------------------------------------------------------------------
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS work_mode text NOT NULL DEFAULT 'any';

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_work_mode_chk;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_work_mode_chk CHECK (work_mode IN ('any', 'remote', 'onsite', 'hybrid'));

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS company_name text;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS hide_company_until_applied boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.jobs.work_mode IS 'any | remote | onsite | hybrid';
COMMENT ON COLUMN public.jobs.hide_company_until_applied IS 'When true, company_name shown only to owner, admins, and applicants.';

-- ---------------------------------------------------------------------------
-- Profiles: portfolio JSON + onboarding snooze (vs permanent dismiss)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS portfolio_links jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_snoozed_until timestamptz;

COMMENT ON COLUMN public.profiles.portfolio_links IS 'Array of {label, url, kind?} (link | video); max length enforced in app.';
COMMENT ON COLUMN public.profiles.onboarding_snoozed_until IS 'Hide onboarding panel until this time (remind later).';

-- ---------------------------------------------------------------------------
-- Onboarding bonus: ~80% profile (5/6 signals) + first network action
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_onboarding_bonus()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cat_id uuid;
  prof record;
  profile_pts integer;
  has_skill boolean;
BEGIN
  SELECT * INTO prof FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF prof.is_banned THEN
    RAISE EXCEPTION 'Account suspended';
  END IF;
  IF prof.onboarding_bonus_claimed THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profile_skills WHERE user_id = auth.uid() LIMIT 1
  ) INTO has_skill;

  profile_pts :=
    (CASE WHEN prof.headline IS NOT NULL AND length(trim(prof.headline)) > 0 THEN 1 ELSE 0 END)
    + (CASE WHEN prof.location IS NOT NULL AND length(trim(prof.location)) > 0 THEN 1 ELSE 0 END)
    + (CASE WHEN prof.school_or_org IS NOT NULL AND length(trim(prof.school_or_org)) > 0 THEN 1 ELSE 0 END)
    + (CASE WHEN prof.bio IS NOT NULL AND length(trim(prof.bio)) >= 20 THEN 1 ELSE 0 END)
    + (CASE WHEN prof.avatar_url IS NOT NULL AND length(trim(prof.avatar_url)) > 0 THEN 1 ELSE 0 END)
    + (CASE WHEN has_skill THEN 1 ELSE 0 END)
    + (CASE
         WHEN jsonb_typeof(prof.portfolio_links) = 'array' AND jsonb_array_length(prof.portfolio_links) > 0
         THEN 1 ELSE 0 END);

  IF profile_pts < 6 THEN
    RAISE EXCEPTION 'Complete your profile further â€” need at least 6 of 7 (headline, location, school/org, bio 20+ chars, photo, skill, portfolio link)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.achievements WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Add at least one achievement first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profile_interests WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Pick at least one interest first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.messages WHERE sender_id = auth.uid())
     AND NOT EXISTS (SELECT 1 FROM public.job_applications WHERE applicant_id = auth.uid()) THEN
    RAISE EXCEPTION 'Send a message or apply to a vacancy to finish onboarding';
  END IF;

  SELECT id INTO cat_id FROM public.achievement_categories WHERE slug = 'other' LIMIT 1;
  IF cat_id IS NULL THEN
    RAISE EXCEPTION 'Missing achievement category';
  END IF;

  INSERT INTO public.user_category_scores (user_id, category_id, points)
  VALUES (auth.uid(), cat_id, 50)
  ON CONFLICT (user_id, category_id)
  DO UPDATE SET points = public.user_category_scores.points + excluded.points;

  UPDATE public.profiles
  SET onboarding_bonus_claimed = true,
      onboarding_completed_at = now()
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_onboarding_bonus() TO authenticated;


-- ==================== 20260409210000_engagement_social_staff.sql ====================
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
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

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
  ('almaty', 'USHQN Â· ÐÐ»Ð¼Ð°Ñ‚Ñ‹', 'ÒšÐ°Ð·Ð°Ò›ÑÑ‚Ð°Ð½'),
  ('astana', 'USHQN Â· ÐÑÑ‚Ð°Ð½Ð°', 'ÒšÐ°Ð·Ð°Ò›ÑÑ‚Ð°Ð½'),
  ('shymkent', 'USHQN Â· Ð¨Ñ‹Ð¼ÐºÐµÐ½Ñ‚', 'ÒšÐ°Ð·Ð°Ò›ÑÑ‚Ð°Ð½'),
  ('online', 'ÐžÐ½Ð»Ð°Ð¹Ð½ Ò›Ð°ÑƒÐ°Ð¿Ñ‹', 'ÐšÐµÐ· ÐºÐµÐ»Ð³ÐµÐ½ Ð¶ÐµÑ€')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Mentorship requests (mentee â†’ mentor)
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


-- ==================== 20260409220000_chat_groups_sidebar.sql ====================
-- Group conversations + RPC for sidebar (last message, member ids)

alter table public.conversations
  add column if not exists is_group boolean not null default false;

alter table public.conversations
  add column if not exists title text;

comment on column public.conversations.is_group is 'True when conversation has a custom title and 2+ other members via create_group_conversation.';
comment on column public.conversations.title is 'Display name for group chats; null for 1:1 DM threads.';

-- ---------------------------------------------------------------------------
create or replace function public.create_group_conversation(
  p_title text,
  p_member_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conv_id uuid;
  me uuid := auth.uid();
  mids uuid[];
  u uuid;
  n int;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;
  if p_title is null or length(trim(p_title)) < 1 then
    raise exception 'title required';
  end if;
  if p_member_ids is null then
    raise exception 'members required';
  end if;

  select coalesce(array_agg(s.x order by s.x), array[]::uuid[])
  into mids
  from (
    select distinct unnest(p_member_ids) as x
  ) s
  where s.x is not null
    and s.x <> me
    and exists (select 1 from public.profiles pr where pr.id = s.x);

  n := coalesce(array_length(mids, 1), 0);
  if n < 1 then
    raise exception 'at least one other member required';
  end if;
  if n > 49 then
    raise exception 'too many members';
  end if;

  insert into public.conversations (is_group, title)
  values (true, trim(p_title))
  returning id into conv_id;

  insert into public.conversation_participants (conversation_id, user_id)
  values (conv_id, me);

  foreach u in array mids
  loop
    insert into public.conversation_participants (conversation_id, user_id)
    values (conv_id, u);
  end loop;

  return conv_id;
end;
$$;

grant execute on function public.create_group_conversation(text, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
create table if not exists public.community_chats (
  community_id uuid primary key references public.communities(id) on delete cascade,
  conversation_id uuid not null unique references public.conversations(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.community_chats enable row level security;

drop policy if exists community_chats_select_member on public.community_chats;
create policy community_chats_select_member on public.community_chats
  for select to authenticated
  using (
    exists (
      select 1
      from public.community_members cm
      where cm.community_id = community_chats.community_id
        and cm.user_id = auth.uid()
    )
  );

create or replace function public.get_or_create_community_chat(
  p_community_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conv_id uuid;
  me uuid := auth.uid();
  ctitle text;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.community_members cm
    where cm.community_id = p_community_id
      and cm.user_id = me
  ) then
    raise exception 'not a community member';
  end if;

  select cc.conversation_id into conv_id
  from public.community_chats cc
  where cc.community_id = p_community_id;

  if conv_id is null then
    select c.title into ctitle
    from public.communities c
    where c.id = p_community_id;

    insert into public.conversations (is_group, title)
    values (true, coalesce(ctitle, 'Community'))
    returning id into conv_id;

    insert into public.conversation_participants (conversation_id, user_id)
    select conv_id, cm.user_id
    from public.community_members cm
    where cm.community_id = p_community_id
    on conflict do nothing;

    insert into public.community_chats (community_id, conversation_id)
    values (p_community_id, conv_id)
    on conflict (community_id) do update set conversation_id = excluded.conversation_id;
  else
    insert into public.conversation_participants (conversation_id, user_id)
    values (conv_id, me)
    on conflict do nothing;
  end if;

  return conv_id;
end;
$$;

grant execute on function public.get_or_create_community_chat(uuid) to authenticated;

-- ---------------------------------------------------------------------------
create or replace function public.my_chat_sidebar()
returns table (
  conversation_id uuid,
  is_group boolean,
  title text,
  last_body text,
  last_at timestamptz,
  last_sender_id uuid,
  unread_count integer,
  has_unread boolean,
  other_user_ids uuid[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    coalesce(c.is_group, false),
    c.title,
    lm.body,
    lm.created_at,
    lm.sender_id,
    (
      select count(*)
      from public.messages m2
      where m2.conversation_id = c.id
        and m2.sender_id <> auth.uid()
        and (me.last_read_at is null or m2.created_at > me.last_read_at)
    )::integer as unread_count,
    (
      lm.created_at is not null
      and lm.sender_id is distinct from auth.uid()
      and (me.last_read_at is null or lm.created_at > me.last_read_at)
    ) as has_unread,
    coalesce(
      array_agg(p.user_id) filter (where p.user_id <> auth.uid()),
      '{}'::uuid[]
    ) as other_user_ids
  from public.conversations c
  inner join public.conversation_participants me
    on me.conversation_id = c.id and me.user_id = auth.uid()
  inner join public.conversation_participants p
    on p.conversation_id = c.id
  left join lateral (
    select m.body, m.created_at, m.sender_id
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) lm on true
  group by c.id, c.is_group, c.title, c.created_at, lm.body, lm.created_at, lm.sender_id
  order by coalesce(lm.created_at, c.created_at) desc;
$$;

grant execute on function public.my_chat_sidebar() to authenticated;


-- ==================== 20260411120000_message_reply.sql ====================
-- Reply-to: optional self-reference on messages, same-conversation only

alter table public.messages
  add column if not exists reply_to_id uuid references public.messages (id) on delete set null;

create index if not exists messages_reply_to_id_idx on public.messages (reply_to_id);

create or replace function public.messages_enforce_reply_same_conversation()
returns trigger
language plpgsql
as $$
begin
  if new.reply_to_id is null then
    return new;
  end if;
  if not exists (
    select 1 from public.messages parent
    where parent.id = new.reply_to_id
      and parent.conversation_id = new.conversation_id
  ) then
    raise exception 'reply_to_id must reference a message in the same conversation';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_reply_enforce_trigger on public.messages;
create trigger messages_reply_enforce_trigger
before insert on public.messages
for each row execute function public.messages_enforce_reply_same_conversation();


-- ==================== 20260411130000_security_definer_bypass_rls_for_chat_rpc.sql ====================
-- SECURITY DEFINER RPCs must insert into RLS-protected tables as multiple users.
-- Some Postgres/Supabase setups still evaluate RLS with the invoker; temporarily
-- disable row_security for the transaction so group/DM/community chat RPCs succeed.

-- ---------------------------------------------------------------------------
create or replace function public.get_or_create_dm(other_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conv_id uuid;
  me uuid := auth.uid();
begin
  perform set_config('row_security', 'off', true);

  if me is null then
    raise exception 'not authenticated';
  end if;
  if other_id = me then
    raise exception 'invalid peer';
  end if;

  select c.id into conv_id
  from public.conversations c
  where (
    select count(*) from public.conversation_participants p where p.conversation_id = c.id
  ) = 2
  and exists (
    select 1 from public.conversation_participants p
    where p.conversation_id = c.id and p.user_id = me
  )
  and exists (
    select 1 from public.conversation_participants p
    where p.conversation_id = c.id and p.user_id = other_id
  )
  limit 1;

  if conv_id is null then
    insert into public.conversations default values returning id into conv_id;
    insert into public.conversation_participants (conversation_id, user_id) values
      (conv_id, me),
      (conv_id, other_id);
  end if;

  return conv_id;
end;
$$;

-- ---------------------------------------------------------------------------
create or replace function public.create_group_conversation(
  p_title text,
  p_member_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conv_id uuid;
  me uuid := auth.uid();
  mids uuid[];
  u uuid;
  n int;
begin
  perform set_config('row_security', 'off', true);

  if me is null then
    raise exception 'not authenticated';
  end if;
  if p_title is null or length(trim(p_title)) < 1 then
    raise exception 'title required';
  end if;
  if p_member_ids is null then
    raise exception 'members required';
  end if;

  select coalesce(array_agg(s.x order by s.x), array[]::uuid[])
  into mids
  from (
    select distinct unnest(p_member_ids) as x
  ) s
  where s.x is not null
    and s.x <> me
    and exists (select 1 from public.profiles pr where pr.id = s.x);

  n := coalesce(array_length(mids, 1), 0);
  if n < 1 then
    raise exception 'at least one other member required';
  end if;
  if n > 49 then
    raise exception 'too many members';
  end if;

  insert into public.conversations (is_group, title)
  values (true, trim(p_title))
  returning id into conv_id;

  insert into public.conversation_participants (conversation_id, user_id)
  values (conv_id, me);

  foreach u in array mids
  loop
    insert into public.conversation_participants (conversation_id, user_id)
    values (conv_id, u);
  end loop;

  return conv_id;
end;
$$;

-- ---------------------------------------------------------------------------
create or replace function public.get_or_create_community_chat(
  p_community_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conv_id uuid;
  me uuid := auth.uid();
  ctitle text;
begin
  perform set_config('row_security', 'off', true);

  if me is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.community_members cm
    where cm.community_id = p_community_id
      and cm.user_id = me
  ) then
    raise exception 'not a community member';
  end if;

  select cc.conversation_id into conv_id
  from public.community_chats cc
  where cc.community_id = p_community_id;

  if conv_id is null then
    select c.title into ctitle
    from public.communities c
    where c.id = p_community_id;

    insert into public.conversations (is_group, title)
    values (true, coalesce(ctitle, 'Community'))
    returning id into conv_id;

    insert into public.conversation_participants (conversation_id, user_id)
    select conv_id, cm.user_id
    from public.community_members cm
    where cm.community_id = p_community_id
    on conflict do nothing;

    insert into public.community_chats (community_id, conversation_id)
    values (p_community_id, conv_id)
    on conflict (community_id) do update set conversation_id = excluded.conversation_id;
  else
    insert into public.conversation_participants (conversation_id, user_id)
    values (conv_id, me)
    on conflict do nothing;
  end if;

  return conv_id;
end;
$$;


-- ==================== 20260411140000_username_job_alerts_employer.sql ====================
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 1. Username (@handle) on profiles
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 2. Verified employer badge on profiles
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
alter table public.profiles
  add column if not exists is_verified_employer boolean not null default false;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 3. Job alerts: users subscribe to a filter, get a
--    notification when a new job matches
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 4. Trigger: when a new job is inserted, notify matching
--    job_alert subscribers with an in-app notification
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    txt := coalesce(new.title, 'ÐÐ¾Ð²Ð°Ñ Ð²Ð°ÐºÐ°Ð½ÑÐ¸Ñ');
    insert into public.notifications (user_id, kind, title, body, link)
    values (
      rec.user_id,
      'job_alert',
      txt,
      'Ð¡Ñ–Ð·Ð³Ðµ ÑÓ™Ð¹ÐºÐµÑ Ð¶Ð°Ò£Ð° Ð²Ð°ÐºÐ°Ð½ÑÐ¸Ñ Ð¶Ð°Ñ€Ð¸ÑÐ»Ð°Ð½Ð´Ñ‹',
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


-- ==================== 20260411150000_fix_rls_conv_participants.sql ====================
-- Fix: infinite recursion in conv_part_select policy.
-- The old policy queried the same table inside EXISTS(), causing recursion.
-- New approach: direct table access is limited to own row only;
-- a SECURITY DEFINER function is provided for listing all members.

drop policy if exists conv_part_select on public.conversation_participants;

create policy conv_part_select on public.conversation_participants
  for select to authenticated
  using (user_id = auth.uid());

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Helper: get all participants of a conversation that
-- the calling user is a member of. Bypasses RLS via SECURITY DEFINER.
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create or replace function public.get_conversation_members(p_conv_id uuid)
returns table(user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select cp.user_id
  from public.conversation_participants cp
  where cp.conversation_id = p_conv_id
    and exists (
      select 1
      from public.conversation_participants me
      where me.conversation_id = p_conv_id
        and me.user_id = auth.uid()
    );
$$;

grant execute on function public.get_conversation_members(uuid) to authenticated;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Also update peer_read query: last_read_at for DM partner.
-- The existing conv_part_update_own policy stays: users update own row.
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€



