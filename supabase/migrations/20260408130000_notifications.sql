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
    'Новый подписчик',
    coalesce(actor_name, 'Пользователь') || ' подписался на вас',
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
    'Новое сообщение',
    coalesce(sender_name, 'Пользователь') || ': ' || left(new.body, 80),
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
    '🏆 Достижение добавлено',
    'Вы добавили: ' || new.title,
    '/achievements'
  );
  return new;
end;
$$;

drop trigger if exists on_new_achievement on public.achievements;
create trigger on_new_achievement
  after insert on public.achievements
  for each row execute function public.notify_on_achievement();
