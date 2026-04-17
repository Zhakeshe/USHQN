-- Admin-managed news feed for homepage updates and announcements.

create table if not exists public.admin_news (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 3 and 160),
  body text not null check (length(trim(body)) between 8 and 2500),
  cta_label text,
  cta_url text,
  is_published boolean not null default false,
  is_pinned boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_news_dates_ok check (
    ends_at is null or starts_at is null or ends_at >= starts_at
  )
);

create index if not exists admin_news_published_idx
  on public.admin_news (is_published, is_pinned desc, created_at desc);

drop trigger if exists admin_news_updated_at on public.admin_news;
create trigger admin_news_updated_at
before update on public.admin_news
for each row execute function public.tg_set_updated_at();

alter table public.admin_news enable row level security;

drop policy if exists admin_news_select_public on public.admin_news;
create policy admin_news_select_public
  on public.admin_news
  for select
  to authenticated
  using (
    is_published = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

drop policy if exists admin_news_select_staff on public.admin_news;
create policy admin_news_select_staff
  on public.admin_news
  for select
  to authenticated
  using (public.current_is_staff());

drop policy if exists admin_news_insert_admin on public.admin_news;
create policy admin_news_insert_admin
  on public.admin_news
  for insert
  to authenticated
  with check (public.current_is_admin());

drop policy if exists admin_news_update_admin on public.admin_news;
create policy admin_news_update_admin
  on public.admin_news
  for update
  to authenticated
  using (public.current_is_admin())
  with check (public.current_is_admin());

drop policy if exists admin_news_delete_admin on public.admin_news;
create policy admin_news_delete_admin
  on public.admin_news
  for delete
  to authenticated
  using (public.current_is_admin());
