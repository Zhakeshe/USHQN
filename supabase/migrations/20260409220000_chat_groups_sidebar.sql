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
