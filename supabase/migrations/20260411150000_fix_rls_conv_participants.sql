-- Fix: infinite recursion in conv_part_select policy.
-- The old policy queried the same table inside EXISTS(), causing recursion.
-- New approach: direct table access is limited to own row only;
-- a SECURITY DEFINER function is provided for listing all members.

drop policy if exists conv_part_select on public.conversation_participants;

create policy conv_part_select on public.conversation_participants
  for select to authenticated
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────
-- Helper: get all participants of a conversation that
-- the calling user is a member of. Bypasses RLS via SECURITY DEFINER.
-- ─────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────
-- Also update peer_read query: last_read_at for DM partner.
-- The existing conv_part_update_own policy stays: users update own row.
-- ─────────────────────────────────────────────────────────
