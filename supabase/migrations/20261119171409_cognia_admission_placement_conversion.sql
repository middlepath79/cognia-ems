create or replace function public.convert_admission_application(target_school_id uuid, target_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  application public.admission_applications%rowtype;
  new_student_id uuid;
  generated_number text;
begin
  if (select auth.uid()) is null or not private.has_school_role(target_school_id, array['school_admin']::public.app_role[]) then
    raise exception 'Institution administrator access is required';
  end if;

  select * into application from public.admission_applications
    where id = target_application_id and school_id = target_school_id for update;
  if not found then raise exception 'Application not found'; end if;
  if application.application_status = 'converted' then
    select id into new_student_id from public.students
      where school_id = target_school_id and admission_application_id = target_application_id;
    if new_student_id is not null then return new_student_id; end if;
    raise exception 'Converted application has no linked student';
  end if;
  if application.application_status <> 'accepted' then raise exception 'Only accepted applications can be converted'; end if;

  generated_number := public.generate_student_number(target_school_id);
  insert into public.students (
    school_id, student_number, admission_application_id, first_name, middle_name, surname,
    date_of_birth, gender, email, phone, residential_address, admission_date, status
  ) values (
    target_school_id, generated_number, target_application_id, application.first_name,
    application.middle_name, application.surname, application.date_of_birth, application.gender,
    application.email, application.phone, application.residential_address, current_date, 'admitted'
  ) returning id into new_student_id;

  if application.academic_session_id is not null and application.academic_term_id is not null then
    if application.applied_class_arm_id is not null then
      insert into public.student_enrolments (
        school_id, student_id, structure_type, class_arm_id, academic_session_id, academic_term_id
      ) values (
        target_school_id, new_student_id, 'basic', application.applied_class_arm_id,
        application.academic_session_id, application.academic_term_id
      );
    elsif application.applied_programme_id is not null and application.applied_academic_level_id is not null then
      insert into public.student_enrolments (
        school_id, student_id, structure_type, programme_id, academic_level_id, academic_session_id, academic_term_id
      ) values (
        target_school_id, new_student_id, 'programme', application.applied_programme_id,
        application.applied_academic_level_id, application.academic_session_id, application.academic_term_id
      );
    end if;
  end if;

  update public.admission_applications set application_status = 'converted', converted_at = now()
    where id = target_application_id and school_id = target_school_id;
  return new_student_id;
end;
$$;
