drop policy course_enrolments_read_authorized on public.course_enrolments;
create policy course_enrolments_read_authorized on public.course_enrolments for select to authenticated
  using (private.has_school_role(school_id,array['school_admin']::public.app_role[])
    or private.can_manage_attendance_scope(school_id,'course',null,null,subject_id,academic_session_id)
    or (private.has_school_role(school_id,array['student']::public.app_role[])
      and exists (select 1 from public.students s where s.id=course_enrolments.student_id and s.school_id=course_enrolments.school_id and s.auth_user_id=(select auth.uid()))));

drop policy attendance_records_read_assigned_or_self on public.attendance_records;
create policy attendance_records_read_assigned_or_self on public.attendance_records for select to authenticated
  using (private.can_manage_attendance_session(attendance_session_id,school_id)
    or (private.has_school_role(school_id,array['student']::public.app_role[])
      and exists (select 1 from public.students s where s.id=attendance_records.student_id and s.school_id=attendance_records.school_id and s.auth_user_id=(select auth.uid()))));
