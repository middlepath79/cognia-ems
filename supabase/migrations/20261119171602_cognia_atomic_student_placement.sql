create function public.save_student_enrolment(
  target_school_id uuid,
  target_student_id uuid,
  target_structure_type text,
  target_class_arm_id uuid,
  target_programme_id uuid,
  target_academic_level_id uuid,
  target_academic_session_id uuid,
  target_academic_term_id uuid,
  target_starts_on date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_enrolment_id uuid;
begin
  if (select auth.uid()) is null or not private.has_school_role(target_school_id, array['school_admin']::public.app_role[]) then
    raise exception 'Institution administrator access is required';
  end if;
  if target_structure_type not in ('basic', 'programme') or target_starts_on is null then
    raise exception 'Invalid academic placement';
  end if;
  if not exists (select 1 from public.students where id=target_student_id and school_id=target_school_id) then
    raise exception 'Student not found';
  end if;

  insert into public.student_enrolments (
    school_id, student_id, structure_type, class_arm_id, programme_id,
    academic_level_id, academic_session_id, academic_term_id, starts_on, is_current
  ) values (
    target_school_id, target_student_id, target_structure_type, target_class_arm_id, target_programme_id,
    target_academic_level_id, target_academic_session_id, target_academic_term_id, target_starts_on, false
  ) returning id into new_enrolment_id;

  update public.student_enrolments set is_current=false, ends_on=target_starts_on
    where school_id=target_school_id and student_id=target_student_id and is_current=true;
  update public.student_enrolments set is_current=true, ends_on=null
    where id=new_enrolment_id and school_id=target_school_id;
  return new_enrolment_id;
end;
$$;
revoke all on function public.save_student_enrolment(uuid, uuid, text, uuid, uuid, uuid, uuid, uuid, date) from public, anon;
grant execute on function public.save_student_enrolment(uuid, uuid, text, uuid, uuid, uuid, uuid, uuid, date) to authenticated;
