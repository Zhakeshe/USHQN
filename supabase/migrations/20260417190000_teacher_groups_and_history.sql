-- Teacher-led classes/clubs and student membership history.

create table if not exists public.teacher_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(trim(title)) between 2 and 120),
  kind text not null default 'club' check (kind in ('class', 'club', 'debate', 'sports', 'other')),
  description text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists teacher_groups_owner_idx on public.teacher_groups(owner_id, created_at desc);
create index if not exists teacher_groups_kind_idx on public.teacher_groups(kind, created_at desc);

drop trigger if exists teacher_groups_updated_at on public.teacher_groups;
create trigger teacher_groups_updated_at
before update on public.teacher_groups
for each row execute function public.set_updated_at();

create table if not exists public.teacher_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.teacher_groups(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  is_active boolean not null default true
);

create index if not exists teacher_group_members_group_idx on public.teacher_group_members(group_id, is_active, joined_at desc);
create index if not exists teacher_group_members_student_idx on public.teacher_group_members(student_id, is_active, joined_at desc);
create unique index if not exists teacher_group_members_active_unique
  on public.teacher_group_members(group_id, student_id)
  where is_active = true;

alter table public.teacher_groups enable row level security;
alter table public.teacher_group_members enable row level security;

drop policy if exists teacher_groups_select_member_or_owner on public.teacher_groups;
create policy teacher_groups_select_member_or_owner
  on public.teacher_groups
  for select
  to authenticated
  using (
    owner_id = auth.uid()
    or exists (
      select 1
      from public.teacher_group_members m
      where m.group_id = teacher_groups.id
        and m.student_id = auth.uid()
        and m.is_active = true
    )
  );

drop policy if exists teacher_groups_insert_owner on public.teacher_groups;
create policy teacher_groups_insert_owner
  on public.teacher_groups
  for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists teacher_groups_update_owner on public.teacher_groups;
create policy teacher_groups_update_owner
  on public.teacher_groups
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists teacher_groups_delete_owner on public.teacher_groups;
create policy teacher_groups_delete_owner
  on public.teacher_groups
  for delete
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists teacher_group_members_select_scope on public.teacher_group_members;
create policy teacher_group_members_select_scope
  on public.teacher_group_members
  for select
  to authenticated
  using (
    student_id = auth.uid()
    or exists (
      select 1
      from public.teacher_groups g
      where g.id = teacher_group_members.group_id
        and g.owner_id = auth.uid()
    )
  );

drop policy if exists teacher_group_members_insert_owner on public.teacher_group_members;
create policy teacher_group_members_insert_owner
  on public.teacher_group_members
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.teacher_groups g
      where g.id = teacher_group_members.group_id
        and g.owner_id = auth.uid()
    )
  );

drop policy if exists teacher_group_members_update_owner on public.teacher_group_members;
create policy teacher_group_members_update_owner
  on public.teacher_group_members
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.teacher_groups g
      where g.id = teacher_group_members.group_id
        and g.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.teacher_groups g
      where g.id = teacher_group_members.group_id
        and g.owner_id = auth.uid()
    )
  );

drop policy if exists teacher_group_members_delete_owner on public.teacher_group_members;
create policy teacher_group_members_delete_owner
  on public.teacher_group_members
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.teacher_groups g
      where g.id = teacher_group_members.group_id
        and g.owner_id = auth.uid()
    )
  );
