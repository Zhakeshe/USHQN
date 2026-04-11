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
