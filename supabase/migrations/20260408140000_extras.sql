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
