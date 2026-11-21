-- Index tenant-scoped foreign keys in their declared order for efficient
-- integrity checks and deletes while keeping the existing history indexes.
create index academic_terms_session_school_fk_idx on public.academic_terms (academic_session_id, school_id);

create index admission_applications_session_school_fk_idx on public.admission_applications (academic_session_id, school_id);
create index admission_applications_term_session_fk_idx on public.admission_applications (academic_term_id, school_id, academic_session_id);
create index admission_applications_class_arm_fk_idx on public.admission_applications (applied_class_arm_id, school_id);
create index admission_applications_programme_fk_idx on public.admission_applications (applied_programme_id, school_id);
create index admission_applications_level_programme_fk_idx on public.admission_applications (applied_academic_level_id, school_id, applied_programme_id);

create index students_application_fk_idx on public.students (admission_application_id, school_id) where admission_application_id is not null;
create index students_auth_user_fk_idx on public.students (auth_user_id) where auth_user_id is not null;
create index class_arms_class_school_fk_idx on public.class_arms (class_id, school_id);

create index student_enrolments_student_school_fk_idx on public.student_enrolments (student_id, school_id);
create index student_enrolments_class_arm_fk_idx on public.student_enrolments (class_arm_id, school_id) where class_arm_id is not null;
create index student_enrolments_programme_fk_idx on public.student_enrolments (programme_id, school_id) where programme_id is not null;
create index student_enrolments_level_programme_fk_idx on public.student_enrolments (academic_level_id, school_id, programme_id) where academic_level_id is not null;
create index student_enrolments_session_school_fk_idx on public.student_enrolments (academic_session_id, school_id);
create index student_enrolments_term_session_fk_idx on public.student_enrolments (academic_term_id, school_id, academic_session_id);

create index student_guardians_student_school_fk_idx on public.student_guardians (student_id, school_id);
create index student_guardians_guardian_school_fk_idx on public.student_guardians (guardian_id, school_id);
create index student_documents_student_school_fk_idx on public.student_documents (student_id, school_id);
create index student_documents_uploaded_by_fk_idx on public.student_documents (uploaded_by);
create index student_status_history_student_school_fk_idx on public.student_status_history (student_id, school_id);
create index student_status_history_changed_by_fk_idx on public.student_status_history (changed_by) where changed_by is not null;
