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
  ('robotics', 'Робототехника', 15),
  ('programming', 'Программирование', 15),
  ('sports', 'Спорт', 10),
  ('debates', 'Дебаты', 12),
  ('science', 'Наука', 12),
  ('arts', 'Искусство', 10),
  ('other', 'Другое', 8);

insert into public.interests (slug, label_ru) values
  ('robotics', 'Робототехника'),
  ('programming', 'Программирование'),
  ('sport', 'Спорт'),
  ('debates', 'Дебаты'),
  ('mentor', 'Наставничество'),
  ('startup', 'Стартапы'),
  ('olympiads', 'Олимпиады'),
  ('volunteering', 'Волонтёрство');

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

-- Only system inserts participants via get_or_create_dm (security definer) — allow insert for self when creating? 
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
