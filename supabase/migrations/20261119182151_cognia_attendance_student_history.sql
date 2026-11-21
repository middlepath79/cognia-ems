create function public.get_student_attendance_history(
  target_school_id uuid,
  target_student_id uuid,
  from_date date default null,
  through_date date default null,
  target_academic_session_id uuid default null,
  target_academic_term_id uuid default null
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
  if not private.has_school_role(target_school_id,array['school_admin']::public.app_role[])
    and not (
      private.has_school_role(target_school_id,array['student']::public.app_role[])
      and exists (select 1 from public.students s where s.id=target_student_id and s.school_id=target_school_id and s.auth_user_id=(select auth.uid()))
    ) then
    raise exception 'Student attendance history access is not allowed';
  end if;
  return query
    select a.id,a.attendance_date,a.attendance_model,
      case when a.attendance_model='class' then
        coalesce(c.name,'Class') || case when a.class_arm_id is null then ' · all arms' else ' · ' || coalesce(ca.name,'Arm') end
      else coalesce(sub.code || ' · ','') || coalesce(sub.name,'Course') || ' · ' || coalesce(a.lecture_label,'Lecture') end,
      a.academic_session_id,acs.name,a.academic_term_id,at.name,r.status,r.remarks
    from public.attendance_sessions a
    join public.academic_sessions acs on acs.id=a.academic_session_id and acs.school_id=a.school_id
    join public.academic_terms at on at.id=a.academic_term_id and at.school_id=a.school_id
    left join public.school_classes c on c.id=a.class_id and c.school_id=a.school_id
    left join public.class_arms ca on ca.id=a.class_arm_id and ca.school_id=a.school_id
    left join public.subjects sub on sub.id=a.subject_id and sub.school_id=a.school_id
    left join public.attendance_records r on r.attendance_session_id=a.id and r.school_id=a.school_id and r.student_id=target_student_id
    where a.school_id=target_school_id
      and private.is_attendance_eligible(a.id,target_school_id,target_student_id)
      and (from_date is null or a.attendance_date>=from_date)
      and (through_date is null or a.attendance_date<=through_date)
      and (target_academic_session_id is null or a.academic_session_id=target_academic_session_id)
      and (target_academic_term_id is null or a.academic_term_id=target_academic_term_id)
    order by a.attendance_date desc,a.created_at desc;
end;
$$;
revoke all on function public.get_student_attendance_history(uuid,uuid,date,date,uuid,uuid) from public,anon;
grant execute on function public.get_student_attendance_history(uuid,uuid,date,date,uuid,uuid) to authenticated;
