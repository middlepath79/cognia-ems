-- A course can be offered to distinct programmes and levels in the same
-- period. Keep that context on both the explicit roster and lecture session.
alter table public.attendance_sessions
  add column programme_id uuid,
  add column academic_level_id uuid,
  add constraint attendance_sessions_course_context_check check (
    (attendance_model='class' and programme_id is null and academic_level_id is null)
    or (attendance_model='course' and programme_id is not null and academic_level_id is not null)
  ),
  add constraint attendance_sessions_programme_school_fkey
    foreign key (programme_id,school_id) references public.academic_programmes(id,school_id) on delete restrict,
  add constraint attendance_sessions_level_programme_fkey
    foreign key (academic_level_id,school_id,programme_id) references public.academic_levels(id,school_id,programme_id) on delete restrict;

alter table public.course_enrolments
  add column programme_id uuid not null,
  add column academic_level_id uuid not null,
  add constraint course_enrolments_programme_school_fkey
    foreign key (programme_id,school_id) references public.academic_programmes(id,school_id) on delete restrict,
  add constraint course_enrolments_level_programme_fkey
    foreign key (academic_level_id,school_id,programme_id) references public.academic_levels(id,school_id,programme_id) on delete restrict;

drop index public.attendance_course_session_unique_idx;
create unique index attendance_course_session_unique_idx on public.attendance_sessions
  (school_id,academic_session_id,academic_term_id,attendance_date,subject_id,programme_id,academic_level_id,lecture_label)
  where attendance_model='course';
create index attendance_sessions_programme_level_idx on public.attendance_sessions (school_id,programme_id,academic_level_id,attendance_date desc) where attendance_model='course';
create index course_enrolments_programme_roster_idx on public.course_enrolments (school_id,programme_id,academic_level_id,subject_id,academic_session_id,academic_term_id,is_active,student_id);

create or replace function private.is_attendance_eligible(target_session_id uuid, target_school_id uuid, target_student_id uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare a public.attendance_sessions%rowtype;
begin
  select * into a from public.attendance_sessions where id=target_session_id and school_id=target_school_id;
  if not found then return false; end if;
  if a.attendance_model='class' then
    return exists (
      select 1 from public.student_enrolments e
      join public.class_arms ca on ca.id=e.class_arm_id and ca.school_id=e.school_id
      join public.students s on s.id=e.student_id and s.school_id=e.school_id
      where e.school_id=target_school_id and e.student_id=target_student_id and e.structure_type='basic'
        and e.academic_session_id=a.academic_session_id and e.academic_term_id=a.academic_term_id
        and ca.class_id=a.class_id and (a.class_arm_id is null or e.class_arm_id=a.class_arm_id)
        and e.starts_on <= a.attendance_date and (e.ends_on is null or e.ends_on >= a.attendance_date)
        and s.status <> 'applicant'::public.student_status
        and not exists (
          select 1 from public.student_enrolments newer
          where newer.school_id=e.school_id and newer.student_id=e.student_id
            and newer.starts_on > e.starts_on and newer.starts_on <= a.attendance_date
            and (newer.ends_on is null or newer.ends_on >= a.attendance_date)
        )
    );
  end if;
  return exists (
    select 1 from public.course_enrolments e
    join public.students s on s.id=e.student_id and s.school_id=e.school_id
    where e.school_id=target_school_id and e.student_id=target_student_id and e.subject_id=a.subject_id
      and e.programme_id=a.programme_id and e.academic_level_id=a.academic_level_id
      and e.academic_session_id=a.academic_session_id and e.academic_term_id=a.academic_term_id
      and e.starts_on <= a.attendance_date and (e.ends_on >= a.attendance_date or (e.ends_on is null and e.is_active))
      and s.status <> 'applicant'::public.student_status
      and exists (
        select 1 from public.student_enrolments placement
        where placement.school_id=e.school_id and placement.student_id=e.student_id
          and placement.structure_type='programme' and placement.programme_id=a.programme_id
          and placement.academic_level_id=a.academic_level_id
          and placement.academic_session_id=a.academic_session_id and placement.academic_term_id=a.academic_term_id
          and placement.is_current and placement.starts_on <= a.attendance_date
          and (placement.ends_on is null or placement.ends_on >= a.attendance_date)
      )
  );
end;
$$;

create or replace function public.get_attendance_roster(target_school_id uuid, target_session_id uuid)
returns table (
  student_id uuid, student_number text, first_name text, middle_name text, surname text,
  attendance_status public.attendance_status, remarks text
)
language plpgsql stable security definer set search_path = '' as $$
declare a public.attendance_sessions%rowtype;
begin
  select * into a from public.attendance_sessions where id=target_session_id and school_id=target_school_id;
  if not found or not private.can_manage_attendance_session(target_session_id,target_school_id) then
    raise exception 'Attendance session access is not allowed';
  end if;
  if a.attendance_model='class' then
    return query
      select s.id,s.student_number,s.first_name,s.middle_name,s.surname,r.status,r.remarks
      from public.student_enrolments e
      join public.class_arms ca on ca.id=e.class_arm_id and ca.school_id=e.school_id
      join public.students s on s.id=e.student_id and s.school_id=e.school_id
      left join public.attendance_records r on r.school_id=s.school_id and r.attendance_session_id=a.id and r.student_id=s.id
      where e.school_id=target_school_id and e.structure_type='basic' and e.academic_session_id=a.academic_session_id
        and e.academic_term_id=a.academic_term_id and ca.class_id=a.class_id
        and (a.class_arm_id is null or e.class_arm_id=a.class_arm_id)
        and e.starts_on <= a.attendance_date and (e.ends_on is null or e.ends_on >= a.attendance_date)
        and s.status <> 'applicant'::public.student_status
        and not exists (
          select 1 from public.student_enrolments newer
          where newer.school_id=e.school_id and newer.student_id=e.student_id
            and newer.starts_on > e.starts_on and newer.starts_on <= a.attendance_date
            and (newer.ends_on is null or newer.ends_on >= a.attendance_date)
        )
      order by s.surname,s.first_name,s.student_number;
  else
    return query
      select s.id,s.student_number,s.first_name,s.middle_name,s.surname,r.status,r.remarks
      from public.course_enrolments e
      join public.students s on s.id=e.student_id and s.school_id=e.school_id
      left join public.attendance_records r on r.school_id=s.school_id and r.attendance_session_id=a.id and r.student_id=s.id
      where e.school_id=target_school_id and e.subject_id=a.subject_id
        and e.programme_id=a.programme_id and e.academic_level_id=a.academic_level_id
        and e.academic_session_id=a.academic_session_id and e.academic_term_id=a.academic_term_id
        and e.starts_on <= a.attendance_date and (e.ends_on >= a.attendance_date or (e.ends_on is null and e.is_active))
        and s.status <> 'applicant'::public.student_status
        and exists (
          select 1 from public.student_enrolments placement
          where placement.school_id=e.school_id and placement.student_id=e.student_id
            and placement.structure_type='programme' and placement.programme_id=a.programme_id
            and placement.academic_level_id=a.academic_level_id
            and placement.academic_session_id=a.academic_session_id and placement.academic_term_id=a.academic_term_id
            and placement.is_current and placement.starts_on <= a.attendance_date
            and (placement.ends_on is null or placement.ends_on >= a.attendance_date)
        )
      order by s.surname,s.first_name,s.student_number;
  end if;
end;
$$;

create or replace function public.get_student_attendance_history(
  target_school_id uuid,
  target_student_id uuid,
  from_date date default null,
  through_date date default null,
  target_academic_session_id uuid default null,
  target_academic_term_id uuid default null,
  target_attendance_model text default null,
  target_context_id uuid default null
)
returns table (
  session_id uuid,
  attendance_date date,
  attendance_model text,
  session_title text,
  academic_session_id uuid,
  academic_session_name text,
  academic_term_id uuid,
  academic_term_name text,
  status public.attendance_status,
  remarks text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Sign in is required'; end if;
  if target_attendance_model is not null and target_attendance_model not in ('class','course') then raise exception 'Invalid attendance model'; end if;
  if not private.has_school_role(target_school_id,array['school_admin']::public.app_role[])
    and not (private.has_school_role(target_school_id,array['student']::public.app_role[])
      and exists (select 1 from public.students s where s.id=target_student_id and s.school_id=target_school_id and s.auth_user_id=(select auth.uid()))) then
    raise exception 'Student attendance history access is not allowed';
  end if;
  return query
    select a.id,a.attendance_date,a.attendance_model,
      case when a.attendance_model='class' then
        coalesce(c.name,'Class') || case when a.class_arm_id is null then ' · all arms' else ' · ' || coalesce(ca.name,'Arm') end
      else coalesce(sub.code || ' · ','') || coalesce(sub.name,'Course') || ' · ' || coalesce(p.name,'Programme') || ' · ' || coalesce(l.name,'Level') || ' · ' || coalesce(a.lecture_label,'Lecture') end,
      a.academic_session_id,acs.name,a.academic_term_id,at.name,r.status,r.remarks
    from public.attendance_sessions a
    join public.academic_sessions acs on acs.id=a.academic_session_id and acs.school_id=a.school_id
    join public.academic_terms at on at.id=a.academic_term_id and at.school_id=a.school_id
    left join public.school_classes c on c.id=a.class_id and c.school_id=a.school_id
    left join public.class_arms ca on ca.id=a.class_arm_id and ca.school_id=a.school_id
    left join public.subjects sub on sub.id=a.subject_id and sub.school_id=a.school_id
    left join public.academic_programmes p on p.id=a.programme_id and p.school_id=a.school_id
    left join public.academic_levels l on l.id=a.academic_level_id and l.school_id=a.school_id
    left join public.attendance_records r on r.attendance_session_id=a.id and r.school_id=a.school_id and r.student_id=target_student_id
    where a.school_id=target_school_id and private.is_attendance_eligible(a.id,target_school_id,target_student_id)
      and (from_date is null or a.attendance_date>=from_date)
      and (through_date is null or a.attendance_date<=through_date)
      and (target_academic_session_id is null or a.academic_session_id=target_academic_session_id)
      and (target_academic_term_id is null or a.academic_term_id=target_academic_term_id)
      and (target_attendance_model is null or a.attendance_model=target_attendance_model)
      and (target_context_id is null or a.class_id=target_context_id or a.class_arm_id=target_context_id or a.subject_id=target_context_id)
    order by a.attendance_date desc,a.created_at desc;
end;
$$;
