-- Current-teacher switching with history retention + student self-join by group code.

alter table public.teacher_groups
  add column if not exists join_code text;

update public.teacher_groups
set join_code = lower(encode(gen_random_bytes(5), 'hex'))
where join_code is null or length(trim(join_code)) = 0;

alter table public.teacher_groups
  alter column join_code set default lower(encode(gen_random_bytes(5), 'hex'));

alter table public.teacher_groups
  alter column join_code set not null;

create unique index if not exists teacher_groups_join_code_uq on public.teacher_groups(join_code);

-- Keep only one active current teacher per student before adding uniqueness.
with ranked as (
  select
    id,
    row_number() over (
      partition by student_id
      order by coalesce(accepted_at, created_at) desc, created_at desc, id desc
    ) as rn
  from public.student_links
  where link_type = 'teacher' and status = 'accepted'
)
update public.student_links sl
set status = 'revoked'
from ranked r
where sl.id = r.id
  and r.rn > 1;

create unique index if not exists student_links_current_teacher_unique
  on public.student_links(student_id)
  where link_type = 'teacher' and status = 'accepted';

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
begin
  select role into role_val from public.profiles where id = auth.uid();
  if role_val not in ('student', 'pupil') then
    raise exception 'Only students can join teacher groups';
  end if;

  select *
  into grp
  from public.teacher_groups
  where join_code = lower(trim(p_join_code))
    and is_archived = false
  limit 1;

  if not found then
    raise exception 'Group code is invalid';
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

  insert into public.teacher_group_members(group_id, student_id, is_active)
  values (grp.id, auth.uid(), true)
  returning id into existing_id;

  return existing_id;
end;
$$;

grant execute on function public.join_teacher_group(text) to authenticated;

create or replace function public.switch_student_teacher(p_student_id uuid, p_new_teacher_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.user_role;
  target_role public.user_role;
  link_id uuid;
begin
  if actor_id is null then
    raise exception 'Not authenticated';
  end if;

  select role into actor_role from public.profiles where id = actor_id;
  select role into target_role from public.profiles where id = p_new_teacher_id;

  if target_role <> 'teacher' then
    raise exception 'Target must be a teacher';
  end if;

  if actor_id <> p_student_id and actor_id <> p_new_teacher_id then
    raise exception 'Not allowed';
  end if;

  if actor_role = 'teacher' and actor_id = p_new_teacher_id then
    if not exists (
      select 1
      from public.student_links s
      where s.student_id = p_student_id
        and s.guardian_id = p_new_teacher_id
        and s.link_type = 'teacher'
    ) then
      raise exception 'Teacher is not linked to this student';
    end if;
  elsif actor_id = p_student_id then
    if actor_role not in ('student', 'pupil') then
      raise exception 'Only students can switch for self';
    end if;
  else
    raise exception 'Not allowed';
  end if;

  update public.student_links
  set status = 'revoked'
  where student_id = p_student_id
    and link_type = 'teacher'
    and status = 'accepted'
    and guardian_id is distinct from p_new_teacher_id;

  update public.student_links
  set status = 'accepted',
      accepted_at = coalesce(accepted_at, now())
  where student_id = p_student_id
    and guardian_id = p_new_teacher_id
    and link_type = 'teacher'
  returning id into link_id;

  if link_id is null then
    raise exception 'Teacher link not found';
  end if;

  return link_id;
end;
$$;

grant execute on function public.switch_student_teacher(uuid, uuid) to authenticated;
