-- Roles + onboarding + invite-based student links (parent/teacher).

alter type public.user_role add value if not exists 'teacher';

alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists onboarding_step text not null default 'welcome';

comment on column public.profiles.onboarding_completed_at is 'Set when the user finishes onboarding flow.';
comment on column public.profiles.onboarding_step is 'Current onboarding step key (welcome|role|profile|invite|done).';

-- Existing users should keep current behavior and skip forced onboarding.
update public.profiles
set onboarding_completed_at = coalesce(onboarding_completed_at, now()),
    onboarding_step = 'done'
where onboarding_completed_at is null;

create table if not exists public.student_links (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  guardian_id uuid references public.profiles(id) on delete cascade,
  link_type text not null check (link_type in ('parent', 'teacher')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invite_code text not null unique,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index if not exists student_links_student_idx on public.student_links(student_id, status, created_at desc);
create index if not exists student_links_guardian_idx on public.student_links(guardian_id, status, created_at desc);

alter table public.student_links enable row level security;

drop policy if exists student_links_select_participants on public.student_links;
create policy student_links_select_participants
  on public.student_links
  for select
  to authenticated
  using (auth.uid() = student_id or auth.uid() = guardian_id);

drop policy if exists student_links_insert_student on public.student_links;
create policy student_links_insert_student
  on public.student_links
  for insert
  to authenticated
  with check (
    student_id = auth.uid()
    and guardian_id is null
    and status = 'pending'
  );

drop policy if exists student_links_delete_student on public.student_links;
create policy student_links_delete_student
  on public.student_links
  for delete
  to authenticated
  using (student_id = auth.uid());

create or replace function public.create_student_invite(p_link_type text)
returns table (id uuid, invite_code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  role_val public.user_role;
  code_val text;
begin
  if p_link_type not in ('parent', 'teacher') then
    raise exception 'Invalid link type';
  end if;

  select role into role_val from public.profiles where id = auth.uid();
  if role_val is null then
    raise exception 'Profile missing';
  end if;
  if role_val not in ('student', 'pupil') then
    raise exception 'Only students can create invites';
  end if;

  code_val := lower(encode(gen_random_bytes(5), 'hex'));

  return query
  insert into public.student_links (student_id, guardian_id, link_type, status, invite_code, expires_at)
  values (auth.uid(), null, p_link_type, 'pending', code_val, now() + interval '14 days')
  returning student_links.id, student_links.invite_code, student_links.expires_at;
end;
$$;

grant execute on function public.create_student_invite(text) to authenticated;

create or replace function public.accept_student_invite(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  link_rec public.student_links%rowtype;
  role_val public.user_role;
begin
  select role into role_val from public.profiles where id = auth.uid();
  if role_val not in ('parent', 'teacher') then
    raise exception 'Only parent or teacher can accept invite';
  end if;

  select *
  into link_rec
  from public.student_links
  where invite_code = lower(trim(p_invite_code))
    and status = 'pending'
    and guardian_id is null
    and expires_at > now()
  limit 1;

  if not found then
    raise exception 'Invite is invalid or expired';
  end if;

  if link_rec.link_type = 'teacher' and role_val <> 'teacher' then
    raise exception 'Teacher invite requires teacher role';
  end if;
  if link_rec.link_type = 'parent' and role_val <> 'parent' then
    raise exception 'Parent invite requires parent role';
  end if;

  update public.student_links
  set guardian_id = auth.uid(),
      status = 'accepted',
      accepted_at = now()
  where id = link_rec.id;

  return link_rec.id;
end;
$$;

grant execute on function public.accept_student_invite(text) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  referred_by_val uuid;
begin
  referred_by_val := null;

  if new.raw_user_meta_data ? 'referred_by' then
    begin
      referred_by_val := (nullif(trim(new.raw_user_meta_data->>'referred_by'), ''))::uuid;
    exception when others then
      referred_by_val := null;
    end;
  end if;

  insert into public.profiles (id, display_name, role, referred_by, onboarding_step, onboarding_completed_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    case
      when new.raw_user_meta_data->>'role' in ('pupil', 'student', 'parent', 'teacher')
      then (new.raw_user_meta_data->>'role')::public.user_role
      else 'student'::public.user_role
    end,
    referred_by_val,
    'welcome',
    null
  );

  return new;
end;
$$;
