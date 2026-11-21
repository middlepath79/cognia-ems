import PageHeading from "@/components/page-heading";
import { getCurrentAttendanceSchool } from "@/lib/attendance-workspace";
import AcademicRecordsManager from "./manager";

export default async function AcademicRecordsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const { supabase, school, role } = await getCurrentAttendanceSchool();
  const [configuration, gradingScale, students, sessions, terms, subjects, arms, programmes, levels, results, resultHistory, gpas, gpaHistory, transcripts, adjustments, progressRecords] = await Promise.all([
    supabase.from("academic_grading_configurations").select("*").eq("school_id", school.id).eq("is_active", true).maybeSingle(),
    supabase.from("schools").select("grading_scale").eq("id", school.id).maybeSingle(),
    supabase.from("students").select("id,student_number,first_name,middle_name,surname").eq("school_id", school.id).order("surname").limit(500),
    supabase.from("academic_sessions").select("id,name,is_active,starts_on").eq("school_id", school.id).order("starts_on", { ascending: false }),
    supabase.from("academic_terms").select("id,name,academic_session_id,is_active,starts_on").eq("school_id", school.id).order("starts_on", { ascending: false }),
    supabase.from("subjects").select("id,name,code,credit_units").eq("school_id", school.id).order("name"),
    supabase.from("class_arms").select("id,name,class_id").eq("school_id", school.id).order("name"),
    supabase.from("academic_programmes").select("id,name").eq("school_id", school.id).order("name"),
    supabase.from("academic_levels").select("id,name,programme_id").eq("school_id", school.id).order("sort_order"),
    supabase.from("academic_period_results").select("*").eq("school_id", school.id).order("updated_at", { ascending: false }).limit(300),
    supabase.from("academic_period_result_history").select("id,result_id,previous_values,new_values,correction_reason,changed_by,changed_at").eq("school_id", school.id).order("changed_at", { ascending: false }).limit(500),
    supabase.from("academic_period_gpas").select("*").eq("school_id", school.id).order("calculated_at", { ascending: false }).limit(300),
    supabase.from("academic_period_gpa_history").select("id,gpa_id,previous_values,new_values,changed_by,changed_at").eq("school_id", school.id).order("changed_at", { ascending: false }).limit(500),
    supabase.from("transcript_issues").select("id,student_id,transcript_reference,issued_at,voided_at,void_reason,correction_of").eq("school_id", school.id).order("issued_at", { ascending: false }).limit(100),
    supabase.from("academic_credit_adjustments").select("id,student_id,adjustment_type,subject_id,academic_session_id,academic_term_id,credit_units,grade,grade_point,source_institution,reason,status,created_at").eq("school_id", school.id).order("created_at", { ascending: false }).limit(200),
    supabase.from("academic_progress_records").select("id,student_id,academic_session_id,academic_term_id,progression_status,decision_reason,is_published,structure_type").eq("school_id", school.id).order("created_at", { ascending: false }).limit(300),
  ]);
  const error = [gradingScale, students, sessions, terms, subjects, arms, programmes, levels, results, resultHistory, gpas, gpaHistory, transcripts, adjustments, progressRecords].some(query => query.error);
  const studentIds = [...new Set([...(results.data ?? []).map(row => row.student_id), ...(gpas.data ?? []).map(row => row.student_id), ...(transcripts.data ?? []).map(row => row.student_id), ...(adjustments.data ?? []).map(row => row.student_id), ...(progressRecords.data ?? []).map(row => row.student_id)])];
  const relatedStudents = studentIds.length ? await supabase.from("students").select("id,student_number,first_name,middle_name,surname").eq("school_id", school.id).in("id", studentIds) : { data: [] };
  const visibleResults = (results.data ?? []).filter(row => {
    if (!params.q) return true;
    const student = relatedStudents.data?.find(item => item.id === row.student_id);
    return `${student?.student_number ?? ""} ${student?.first_name ?? ""} ${student?.surname ?? ""} ${row.grade ?? ""}`.toLowerCase().includes(params.q.toLowerCase());
  });
  return <>
    <PageHeading title="Academic records" description={`Final results, GPA and transcript records for ${school.name}.`} />
    {error ? <section className="card p-6 text-sm text-rose-700" role="alert">Academic records are unavailable. Confirm that the pending academic records migration has been deployed.</section> : <AcademicRecordsManager
      role={role} gradingScale={gradingScale.data?.grading_scale ?? { maximum: 100 }} configuration={configuration.data}
      students={students.data ?? []} sessions={sessions.data ?? []} terms={terms.data ?? []}
      subjects={subjects.data ?? []} arms={arms.data ?? []} programmes={programmes.data ?? []} levels={levels.data ?? []}
      results={visibleResults} resultHistory={resultHistory.data ?? []} resultStudents={relatedStudents.data ?? []} gpas={gpas.data ?? []} gpaHistory={gpaHistory.data ?? []} transcripts={transcripts.data ?? []} adjustments={adjustments.data ?? []} progressRecords={progressRecords.data ?? []} />}
  </>;
}
