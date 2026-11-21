create or replace function private.can_read_timetable(target_school_id uuid,target_entry_id uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare e public.timetable_entries%rowtype; p public.timetable_plans%rowtype;
begin
  select * into e from public.timetable_entries where id=target_entry_id and school_id=target_school_id and is_active;
  if not found then return false; end if;
  if private.has_school_role(target_school_id,array['school_admin']::public.app_role[]) then return true; end if;
  select * into p from public.timetable_plans where id=e.timetable_plan_id and school_id=e.school_id;
  if p.status<>'published' then return false; end if;
  if private.has_school_role(target_school_id,array['teacher']::public.app_role[]) then
    return e.staff_user_id=(select auth.uid()) and exists(select 1 from public.attendance_staff_assignments a where a.school_id=e.school_id and a.teacher_user_id=(select auth.uid()) and a.academic_session_id=p.academic_session_id and a.is_active and a.assignment_type=e.scheduling_model and ((e.scheduling_model='class' and a.class_id=e.class_id and (a.class_arm_id is null or a.class_arm_id is not distinct from e.class_arm_id)) or (e.scheduling_model='course' and a.subject_id=e.subject_id)));
  end if;
  if private.has_school_role(target_school_id,array['student']::public.app_role[]) then
    return exists(select 1 from public.students s where s.school_id=e.school_id and s.auth_user_id=(select auth.uid()) and (
      (e.scheduling_model='class' and exists(select 1 from public.student_enrolments x where x.school_id=s.school_id and x.student_id=s.id and x.structure_type='basic' and x.class_arm_id in (select a.id from public.class_arms a where a.school_id=e.school_id and a.class_id=e.class_id and (e.class_arm_id is null or a.id=e.class_arm_id)) and x.academic_session_id=p.academic_session_id and x.academic_term_id=p.academic_term_id and x.is_current))
      or (e.scheduling_model='course' and exists(select 1 from public.course_enrolments x where x.school_id=s.school_id and x.student_id=s.id and x.subject_id=e.subject_id and x.programme_id=e.programme_id and x.academic_level_id=e.academic_level_id and x.academic_session_id=p.academic_session_id and x.academic_term_id=p.academic_term_id and x.is_active))
    ));
  end if;
  return false;
end;
$$;
