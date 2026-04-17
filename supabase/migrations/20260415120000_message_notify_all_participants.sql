-- Notify every conversation participant except the sender (fixes group chats where only one recipient got a row).

create or replace function public.notify_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
  recipient record;
  snippet text;
begin
  select coalesce(display_name, username, 'User') into sender_name
  from public.profiles
  where id = new.sender_id;

  snippet := left(coalesce(new.body, ''), 80);

  for recipient in
    select user_id
    from public.conversation_participants
    where conversation_id = new.conversation_id
      and user_id is distinct from new.sender_id
  loop
    insert into public.notifications(user_id, actor_id, kind, title, body, link)
    values (
      recipient.user_id,
      new.sender_id,
      'message',
      'Новое сообщение',
      coalesce(sender_name, 'User') || ': ' || snippet,
      '/chat/' || new.conversation_id::text
    );
  end loop;

  return new;
end;
$$;
