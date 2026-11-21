-- Serialize course registration changes against timetable entry creation.
-- Entry writes already lock the matching school/session/term/weekday key. A
-- course registration locks every weekday key in a stable order, so an
-- enrolment and a schedule cannot both pass while unaware of each other.
create function private.lock_course_enrolment_timetable_days()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare day_index integer;
begin
  if not new.is_active then return new; end if;
  for day_index in 0..6 loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        new.school_id::text || ':' || new.academic_session_id::text || ':' ||
        new.academic_term_id::text || ':' || day_index::text,
        0
      )
    );
  end loop;
  return new;
end;
$$;
revoke all on function private.lock_course_enrolment_timetable_days() from public, anon;
create trigger course_enrolment_timetable_advisory_lock
before insert or update of is_active, starts_on, ends_on, subject_id, programme_id, academic_level_id, academic_session_id, academic_term_id
on public.course_enrolments
for each row execute function private.lock_course_enrolment_timetable_days();

-- A stale explicit course registration must not expose a student's timetable
-- after their active academic placement moves to another programme or level.
create or replace function private.can_read_timetable(target_school_id uuid,target_entry_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare e public.timetable_entries%rowtype; p public.timetable_plans%rowtype;
begin
  select * into e
  from public.timetable_entries
  where id=target_entry_id and school_id=target_school_id and is_active;
  if not found then return false; end if;
  if private.has_school_role(target_school_id,array['school_admin']::public.app_role[]) then return true; end if;

  select * into p from public.timetable_plans where id=e.timetable_plan_id and school_id=e.school_id;
  if p.status<>'published' then return false; end if;

  if private.has_school_role(target_school_id,array['teacher']::public.app_role[]) then
    return e.staff_user_id=(select auth.uid()) and exists(
      select 1 from public.attendance_staff_assignments a
      where a.school_id=e.school_id and a.teacher_user_id=(select auth.uid())
        and a.academic_session_id=p.academic_session_id and a.is_active
        and a.assignment_type=e.scheduling_model
        and ((e.scheduling_model='class' and a.class_id=e.class_id
              and (a.class_arm_id is null or a.class_arm_id is not distinct from e.class_arm_id))
          or (e.scheduling_model='course' and a.subject_id=e.subject_id))
    );
  end if;

  if private.has_school_role(target_school_id,array['student']::public.app_role[]) then
    return exists(
      select 1 from public.students s
      where s.school_id=e.school_id and s.auth_user_id=(select auth.uid())
        and (
          (e.scheduling_model='class' and exists(
            select 1 from public.student_enrolments x
            where x.school_id=s.school_id and x.student_id=s.id and x.structure_type='basic'
              and x.class_arm_id in (
                select a.id from public.class_arms a
                where a.school_id=e.school_id and a.class_id=e.class_id
                  and (e.class_arm_id is null or a.id=e.class_arm_id)
              )
              and x.academic_session_id=p.academic_session_id
              and x.academic_term_id=p.academic_term_id and x.is_current
          ))
          or
          (e.scheduling_model='course' and exists(
            select 1 from public.course_enrolments ce
            join public.academic_terms term
              on term.id=p.academic_term_id and term.school_id=p.school_id
                and term.academic_session_id=p.academic_session_id
            join public.student_enrolments placement
              on placement.school_id=ce.school_id and placement.student_id=ce.student_id
                and placement.structure_type='programme'
                and placement.programme_id=e.programme_id
                and placement.academic_level_id=e.academic_level_id
                and placement.academic_session_id=p.academic_session_id
                and placement.academic_term_id=p.academic_term_id
                and placement.is_current
                and placement.starts_on<=term.ends_on
                and (placement.ends_on is null or placement.ends_on>=term.starts_on)
            where ce.school_id=s.school_id and ce.student_id=s.id
              and ce.subject_id=e.subject_id and ce.programme_id=e.programme_id
              and ce.academic_level_id=e.academic_level_id
              and ce.academic_session_id=p.academic_session_id
              and ce.academic_term_id=p.academic_term_id and ce.is_active
          ))
        )
    );
  end if;
  return false;
end;
$$;
revoke all on function private.can_read_timetable(uuid,uuid) from public,anon;
grant execute on function private.can_read_timetable(uuid,uuid) to authenticated;

-- INSERT ... RETURNING also requires SELECT visibility. Give administrators a
-- direct row-tenant role path instead of making it depend on the helper's
-- lookup of the tuple currently being inserted.
drop policy timetable_entries_read on public.timetable_entries;
create policy timetable_entries_read on public.timetable_entries
for select to authenticated
using (
  private.has_school_role(school_id,array['school_admin']::public.app_role[])
  or private.can_read_timetable(school_id,id)
);
