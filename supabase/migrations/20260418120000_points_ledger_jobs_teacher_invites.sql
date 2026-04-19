-- Point transaction log, leaderboard RPC with filters, job vacancy status, teacher group invite expiry & guest/leave/remove.

-- ---------------------------------------------------------------------------
-- 1) Point ledger (fed by user_category_scores changes)
-- ---------------------------------------------------------------------------
create table if not exists public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta integer not null,
  category_id uuid references public.achievement_categories(id) on delete set null,
  reason_code text not null default 'category_score',
  created_at timestamptz not null default now()
);

create index if not exists point_transactions_user_created_idx
  on public.point_transactions (user_id, created_at desc);

alter table public.point_transactions enable row level security;

drop policy if exists point_transactions_select_own on public.point_transactions;
create policy point_transactions_select_own
  on public.point_transactions
  for select
  to authenticated
  using (user_id = auth.uid());

create or replace function public.log_point_transaction_from_category_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d int;
begin
  if tg_op = 'INSERT' then
    d := new.points;
    if d = 0 then return new; end if;
    insert into public.point_transactions (user_id, delta, category_id, reason_code)
    values (new.user_id, d, new.category_id, 'category_score');
    return new;
  elsif tg_op = 'UPDATE' then
    d := new.points - old.points;
    if d = 0 then return new; end if;
    insert into public.point_transactions (user_id, delta, category_id, reason_code)
    values (new.user_id, d, new.category_id, 'category_score');
    return new;
  elsif tg_op = 'DELETE' then
    d := -old.points;
    if d = 0 then return old; end if;
    insert into public.point_transactions (user_id, delta, category_id, reason_code)
    values (old.user_id, d, old.category_id, 'category_score');
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists user_category_scores_log_points on public.user_category_scores;
create trigger user_category_scores_log_points
  after insert or update or delete on public.user_category_scores
  for each row execute function public.log_point_transaction_from_category_score();

-- ---------------------------------------------------------------------------
-- 2) Leaderboard with optional filters (city/school substring + teacher group)
-- ---------------------------------------------------------------------------
create or replace function public.leaderboard_totals(
  p_city_sub text default null,
  p_class_sub text default null,
  p_teacher_group_id uuid default null
)
returns table (
  user_id uuid,
  total_points bigint,
  display_name text,
  avatar_url text
)
language sql
stable
security invoker
set search_path = public
as $$
  with filtered_users as (
    select p.id
    from public.profiles p
    where
      (p_city_sub is null or btrim(p_city_sub) = '' or p.location ilike '%' || btrim(p_city_sub) || '%')
      and (p_class_sub is null or btrim(p_class_sub) = '' or p.school_or_org ilike '%' || btrim(p_class_sub) || '%')
      and (
        p_teacher_group_id is null
        or exists (
          select 1
          from public.teacher_group_members m
          where m.group_id = p_teacher_group_id
            and m.student_id = p.id
            and m.is_active = true
        )
      )
  ),
  totals as (
    select s.user_id, sum(s.points)::bigint as total_points
    from public.user_category_scores s
    inner join filtered_users f on f.id = s.user_id
    group by s.user_id
  )
  select t.user_id, t.total_points, pr.display_name, pr.avatar_url
  from totals t
  inner join public.profiles pr on pr.id = t.user_id
  where t.total_points > 0
  order by t.total_points desc, pr.display_name asc;
$$;

grant execute on function public.leaderboard_totals(text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Jobs: vacancy lifecycle
-- ---------------------------------------------------------------------------
alter table public.jobs
  add column if not exists vacancy_status text not null default 'open';

alter table public.jobs
  add column if not exists closed_reason text,
  add column if not exists closed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'jobs_vacancy_status_check'
  ) then
    alter table public.jobs
      add constraint jobs_vacancy_status_check
      check (vacancy_status in ('open', 'filled', 'closed_not_needed', 'closed_other'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4) Teacher groups: invite expiry, guest members, RPCs
-- ---------------------------------------------------------------------------
alter table public.teacher_groups
  add column if not exists join_code_expires_at timestamptz,
  add column if not exists invite_rotated_at timestamptz;

alter table public.teacher_group_members
  add column if not exists is_guest boolean not null default false;

create or replace function public.join_teacher_group(p_join_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  grp public.teacher_groups%rowtype;
  role_val public.user_role;
  existing_id uuid;
  code text := lower(trim(coalesce(p_join_code, '')));
begin
  perform set_config('row_security', 'off', true);

  select role into role_val from public.profiles where id = auth.uid();
  if role_val not in ('student', 'pupil') then
    raise exception 'Only students can join teacher groups';
  end if;

  select *
  into grp
  from public.teacher_groups
  where join_code = code
    and is_archived = false
  limit 1;

  if not found then
    raise exception 'Group code is invalid';
  end if;

  if grp.join_code_expires_at is not null and grp.join_code_expires_at < now() then
    raise exception 'Join code has expired — ask your teacher for a new code';
  end if;

  select id
  into existing_id
  from public.teacher_group_members
  where group_id = grp.id
    and student_id = auth.uid()
    and is_active = true
  limit 1;

  if existing_id is not null then
    return existing_id;
  end if;

  insert into public.teacher_group_members (group_id, student_id, is_active, is_guest)
  values (grp.id, auth.uid(), true, false)
  returning id into existing_id;

  return existing_id;
end;
$$;

grant execute on function public.join_teacher_group(text) to authenticated;

create or replace function public.regenerate_teacher_group_join_code(p_group_id uuid)
returns table (join_code text, join_code_expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  new_code text := lower(encode(gen_random_bytes(5), 'hex'));
  exp timestamptz := now() + interval '30 days';
begin
  perform set_config('row_security', 'off', true);

  if me is null then
    raise exception 'Not authenticated';
  end if;

  update public.teacher_groups g
  set
    join_code = new_code,
    join_code_expires_at = exp,
    invite_rotated_at = now(),
    updated_at = now()
  where g.id = p_group_id
    and g.owner_id = me
    and g.is_archived = false;

  if not found then
    raise exception 'Group not found or not allowed';
  end if;

  return query select new_code, exp;
end;
$$;

grant execute on function public.regenerate_teacher_group_join_code(uuid) to authenticated;

create or replace function public.leave_teacher_group(p_group_id uuid)
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
    raise exception 'Not authenticated';
  end if;

  update public.teacher_group_members m
  set is_active = false,
      left_at = now()
  where m.group_id = p_group_id
    and m.student_id = me
    and m.is_active = true;

  if not found then
    raise exception 'Not an active member';
  end if;
end;
$$;

grant execute on function public.leave_teacher_group(uuid) to authenticated;

create or replace function public.remove_teacher_group_member(p_group_id uuid, p_student_id uuid)
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
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.teacher_groups g
    where g.id = p_group_id and g.owner_id = me
  ) then
    raise exception 'Not allowed';
  end if;

  update public.teacher_group_members m
  set is_active = false,
      left_at = now()
  where m.group_id = p_group_id
    and m.student_id = p_student_id
    and m.is_active = true;

  if not found then
    raise exception 'Member not found';
  end if;
end;
$$;

grant execute on function public.remove_teacher_group_member(uuid, uuid) to authenticated;
