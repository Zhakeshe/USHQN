-- Align remote DBs: extras columns + chat ownership + public channels by slug.
-- Fixes PostgREST "bio column not in schema cache" when 20260408140000 was skipped.

alter table public.profiles
  add column if not exists bio text,
  add column if not exists github_url text,
  add column if not exists telegram_url text,
  add column if not exists linkedin_url text,
  add column if not exists website_url text;

alter table public.conversations
  add column if not exists created_by uuid references public.profiles (id) on delete set null,
  add column if not exists is_public_channel boolean not null default false,
  add column if not exists channel_slug text;

create unique index if not exists conversations_public_channel_slug_uq
  on public.conversations (lower(channel_slug))
  where coalesce(is_public_channel, false) = true and channel_slug is not null;

-- Deterministic surrogate owner for existing group threads (smallest user_id by text sort; avoids min(uuid) on older Postgres).
update public.conversations c
set created_by = sub.owner_id
from (
  select
    cp.conversation_id,
    (array_agg(cp.user_id order by cp.user_id::text))[1] as owner_id
  from public.conversation_participants cp
  inner join public.conversations conv on conv.id = cp.conversation_id
    and coalesce(conv.is_group, false) = true
  group by cp.conversation_id
) sub
where c.id = sub.conversation_id
  and coalesce(c.is_group, false) = true
  and c.created_by is null;

drop policy if exists conv_select_public_channel on public.conversations;

create policy conv_select_public_channel on public.conversations
  for select to authenticated
  using (coalesce(is_public_channel, false) = true);

-- ---------------------------------------------------------------------------
-- Sidebar: include public-channel flags for UI.
-- ---------------------------------------------------------------------------
create or replace function public.my_chat_sidebar()
returns table (
  conversation_id uuid,
  is_group boolean,
  title text,
  is_public_channel boolean,
  channel_slug text,
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
    coalesce(c.is_public_channel, false),
    c.channel_slug,
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
  group by
    c.id,
    c.is_group,
    c.title,
    c.is_public_channel,
    c.channel_slug,
    c.created_at,
    lm.body,
    lm.created_at,
    lm.sender_id
  order by coalesce(lm.created_at, c.created_at) desc;
$$;

grant execute on function public.my_chat_sidebar() to authenticated;

-- ---------------------------------------------------------------------------
-- Group create: record owner.
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

  insert into public.conversations (is_group, title, created_by)
  values (true, trim(p_title), me)
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
-- Public channel: unique slug, optional extra members (0+).
-- ---------------------------------------------------------------------------
create or replace function public.create_public_channel(
  p_title text,
  p_slug text,
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
  slug text := lower(trim(coalesce(p_slug, '')));
begin
  perform set_config('row_security', 'off', true);

  if me is null then
    raise exception 'not authenticated';
  end if;
  if p_title is null or length(trim(p_title)) < 1 then
    raise exception 'title required';
  end if;
  if slug is null or length(slug) < 1 then
    raise exception 'slug required';
  end if;
  if slug !~ '^[a-z0-9_]{3,30}$' then
    raise exception 'invalid slug';
  end if;
  if exists (
    select 1
    from public.conversations c
    where coalesce(c.is_public_channel, false) = true
      and lower(c.channel_slug) = slug
  ) then
    raise exception 'slug taken';
  end if;

  select coalesce(array_agg(s.x order by s.x), array[]::uuid[])
  into mids
  from (
    select distinct unnest(coalesce(p_member_ids, array[]::uuid[])) as x
  ) s
  where s.x is not null
    and s.x <> me
    and exists (select 1 from public.profiles pr where pr.id = s.x);

  n := coalesce(array_length(mids, 1), 0);
  if n > 49 then
    raise exception 'too many members';
  end if;

  insert into public.conversations (is_group, title, created_by, is_public_channel, channel_slug)
  values (true, trim(p_title), me, true, slug)
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

grant execute on function public.create_public_channel(text, text, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
create or replace function public.join_public_channel(p_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conv_id uuid;
  me uuid := auth.uid();
  slug text := lower(trim(coalesce(p_slug, '')));
begin
  perform set_config('row_security', 'off', true);

  if me is null then
    raise exception 'not authenticated';
  end if;
  if slug is null or length(slug) < 1 then
    raise exception 'slug required';
  end if;

  select c.id into conv_id
  from public.conversations c
  where coalesce(c.is_public_channel, false) = true
    and lower(c.channel_slug) = slug
  limit 1;

  if conv_id is null then
    raise exception 'channel not found';
  end if;

  insert into public.conversation_participants (conversation_id, user_id)
  values (conv_id, me)
  on conflict do nothing;

  return conv_id;
end;
$$;

grant execute on function public.join_public_channel(text) to authenticated;

-- ---------------------------------------------------------------------------
create or replace function public.rename_group_conversation(
  p_conv_id uuid,
  p_title text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  perform set_config('row_security', 'off', true);

  if me is null then
    raise exception 'not authenticated';
  end if;
  if p_title is null or length(trim(p_title)) < 1 then
    raise exception 'title required';
  end if;
  if not exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = p_conv_id
      and cp.user_id = me
  ) then
    raise exception 'not a participant';
  end if;

  update public.conversations c
  set title = trim(p_title)
  where c.id = p_conv_id
    and coalesce(c.is_group, false) = true
    and c.created_by = me;

  if not FOUND then
    raise exception 'rename not allowed';
  end if;
end;
$$;

grant execute on function public.rename_group_conversation(uuid, text) to authenticated;
