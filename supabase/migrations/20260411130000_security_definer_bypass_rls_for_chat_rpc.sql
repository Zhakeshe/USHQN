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
