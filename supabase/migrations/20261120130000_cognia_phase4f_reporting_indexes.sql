-- Reporting and audit indexes. Additive only.
create index if not exists attendance_records_school_session_student_idx
  on public.attendance_records (school_id, attendance_session_id, student_id);

create index if not exists assessment_scores_school_assessment_student_idx
  on public.assessment_scores (school_id, assessment_id, student_id);

create index if not exists examination_results_school_exam_status_idx
  on public.examination_results (school_id, examination_id, status, student_id);

create index if not exists academic_period_results_school_period_status_idx
  on public.academic_period_results
  (school_id, academic_session_id, academic_term_id, status, student_id);

create index if not exists academic_period_gpas_school_period_student_idx
  on public.academic_period_gpas
  (school_id, academic_session_id, academic_term_id, student_id);

create index if not exists transcript_issues_school_student_issued_idx
  on public.transcript_issues
  (school_id, student_id, issued_at desc);
