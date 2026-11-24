import PageHeading from "@/components/page-heading";
import CsvDownload from "@/components/csv-download";
import { getCurrentSchool } from "@/lib/current-school";
import { createClient } from "@/lib/supabase/server";

interface ReportFilters {
  sessionId?: string;
  termId?: string;
  classId?: string;
  subjectId?: string;
}

interface FilterOptions {
  sessions: { id: string; name: string }[];
  terms: { id: string; name: string }[];
  classes: { id: string; name: string; level?: string | null; arm?: string | null }[];
  subjects: { id: string; name: string; code?: string | null }[];
}

interface StudentResultRow {
  id: string;
  student_id: string;
  subject_id: string;
  session_id: string;
  term_id: string;
  ca_contribution: number | null;
  examination_contribution: number | null;
  final_total: number | null;
  grade: string | null;
  grade_point: number | null;
  student: {
    id: string;
    student_number: string;
    first_name: string;
    middle_name: string | null;
    surname: string;
  } | null;
  subject: {
    id: string;
    name: string;
    code: string | null;
    credits?: number | null;
  } | null;
  session: { id: string; name: string } | null;
  term: { id: string; name: string } | null;
}

interface StudentSummary {
  studentId: string;
  studentNumber: string | null;
  studentName: string;
  totalSubjects: number;
  passedSubjects: number;
  failedSubjects: number;
  averageScore: number | null;
  gpa: number | null;
  results: StudentResultRow[];
}

async function getFilterOptions(schoolId: string): Promise<FilterOptions> {
  const supabase = await createClient();
  const [{ data: sessions }, { data: terms }, { data: classes }, { data: subjects }] = await Promise.all([
    supabase.from("academic_sessions").select("id,name").eq("school_id", schoolId).order("start_date", { ascending: false }),
    supabase.from("academic_terms").select("id,name").eq("school_id", schoolId).order("created_at", { ascending: false }),
    supabase.from("school_classes").select("id,name").eq("school_id", schoolId).order("name"),
    supabase.from("subjects").select("id,name,code").eq("school_id", schoolId).order("name"),
  ]);
  return {
    sessions: sessions || [],
    terms: terms || [],
    classes: classes || [],
    subjects: subjects || [],
  };
}

async function getStudentPerformance(schoolId: string, filters: ReportFilters): Promise<StudentSummary[]> {
  const supabase = await createClient();

  let query = supabase
    .from("academic_period_results")
    .select(`
      id,
      student_id,
      subject_id,
      academic_session_id,
      academic_term_id,
      ca_contribution,
      examination_contribution,
      final_total,
      grade,
      grade_point,
      student:students!inner(id, student_number, first_name, middle_name, surname),
      subject:subjects!inner(id, name, code),
      session:academic_sessions!inner(id, name),
      term:academic_terms!inner(id, name)
    `)
    .eq("school_id", schoolId);

  if (filters.sessionId) query = query.eq("academic_session_id", filters.sessionId);
  if (filters.termId) query = query.eq("academic_term_id", filters.termId);
  if (filters.subjectId) query = query.eq("subject_id", filters.subjectId);
  if (filters.classId) {
    const { data: classEnrolments, error: classError } = await supabase
      .from("student_enrolments")
      .select("student_id")
      .eq("school_id", schoolId)
      .eq("class_id", filters.classId)
      .eq("is_active", true);
    if (classError) throw classError;
    const ids = (classEnrolments || []).map((row) => row.student_id);
    if (!ids.length) return [];
    query = query.in("student_id", ids);
  }

  const { data, error } = await query.order("student_id").order("session_id").order("term_id");

  if (error) throw error;

  const byStudent = new Map<string, StudentResultRow[]>();
  (data as unknown as StudentResultRow[] || []).forEach((row) => {
    const key = row.student?.id;
    if (key && !byStudent.has(key)) byStudent.set(key, []);
    if (key) byStudent.get(key)!.push(row);
  });

  const summaries = Array.from(byStudent.entries()).map(([studentId, results]) => {
    const student = results[0]?.student;
    const validResults = results.filter((r) => r.final_total !== null && r.grade_point !== null);
    const totalCredits = validResults.reduce((sum, r) => sum + (r.subject?.credits || 3), 0);
    const totalPoints = validResults.reduce((sum, r) => sum + (r.grade_point || 0) * (r.subject?.credits || 3), 0);
    const gpa = totalCredits > 0 ? totalPoints / totalCredits : null;
    const passCount = validResults.filter((r) => (r.grade_point || 0) >= 1).length;
    const failCount = validResults.filter((r) => (r.grade_point || 0) < 1).length;

    return {
      studentId,
      studentNumber: student?.student_number ?? null,
      studentName: [student?.first_name, student?.middle_name, student?.surname].filter(Boolean).join(" "),
      totalSubjects: results.length,
      passedSubjects: passCount,
      failedSubjects: failCount,
      averageScore: validResults.length > 0 ? validResults.reduce((s, r) => s + (r.final_total || 0), 0) / validResults.length : null,
      gpa,
      results,
    };
  });

  return summaries.sort((a, b) => (b.gpa || 0) - (a.gpa || 0));
}

function generateCSV(summaries: StudentSummary[]) {
  const headers = [
    "Student Number",
    "Student Name",
    "Total Subjects",
    "Passed",
    "Failed",
    "Average Score",
    "GPA",
  ];
  const rows = summaries.map((s) => [
    s.studentNumber,
    s.studentName,
    s.totalSubjects,
    s.passedSubjects,
    s.failedSubjects,
    s.averageScore?.toFixed(2) || "—",
    s.gpa?.toFixed(2) || "—",
  ]);
  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export default async function StudentPerformanceReportPage({
  searchParams,
}: {
  searchParams: Promise<ReportFilters>;
}) {
  const { school } = await getCurrentSchool();
  const filters = await searchParams;
  const options = await getFilterOptions(school.id);
  const summaries = await getStudentPerformance(school.id, filters);

  const passRate = summaries.length > 0
    ? (summaries.filter((s) => s.passedSubjects > 0).length / summaries.length * 100).toFixed(1)
    : "0.0";

  return (
    <>
      <PageHeading
        title="Student Performance Report"
        description="Individual student performance across subjects, terms, and sessions."
        action={
          <div className="flex items-center gap-2">
            <CsvDownload csv={generateCSV(summaries)} filename={`student-performance-${new Date().toISOString().slice(0, 10)}.csv`} disabled={summaries.length === 0} />
          </div>
        }
      />

      <section className="card p-5 mb-6">
        <form method="get" className="grid gap-4 sm:grid-cols-5">
          <select
            className="input"
            name="sessionId"
            defaultValue={filters.sessionId || ""}
          >
            <option value="">All Sessions</option>
            {options.sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select
            className="input"
            name="termId"
            defaultValue={filters.termId || ""}
          >
            <option value="">All Terms</option>
            {options.terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select
            className="input"
            name="classId"
            defaultValue={filters.classId || ""}
          >
            <option value="">All Classes</option>
            {options.classes.map((c) => <option key={c.id} value={c.id}>{c.name} {c.arm ? `(${c.arm})` : ""}</option>)}
          </select>
          <select
            className="input"
            name="subjectId"
            defaultValue={filters.subjectId || ""}
          >
            <option value="">All Subjects</option>
            {options.subjects.map((s) => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
          </select>
          <button type="submit" className="btn btn-primary self-end">Apply filters</button>
        </form>
      </section>

      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        <div className="card p-4"><p className="text-sm text-slate-500">Students</p><p className="text-2xl font-bold text-slate-900">{summaries.length}</p></div>
        <div className="card p-4"><p className="text-sm text-slate-500">Pass Rate</p><p className="text-2xl font-bold text-emerald-600">{passRate}%</p></div>
        <div className="card p-4"><p className="text-sm text-slate-500">Avg GPA</p><p className="text-2xl font-bold text-indigo-600">
          {summaries.length > 0 ? (summaries.reduce((s, a) => s + (a.gpa || 0), 0) / summaries.length).toFixed(2) : "—"}
        </p></div>
        <div className="card p-4"><p className="text-sm text-slate-500">Total Subjects</p><p className="text-2xl font-bold text-slate-900">{summaries.reduce((s, a) => s + a.totalSubjects, 0)}</p></div>
      </div>

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-3 text-left font-semibold text-slate-700">Student</th>
                <th className="p-3 text-left font-semibold text-slate-700">ID</th>
                <th className="p-3 text-right font-semibold text-slate-700">Subjects</th>
                <th className="p-3 text-right font-semibold text-slate-700">Passed</th>
                <th className="p-3 text-right font-semibold text-slate-700">Failed</th>
                <th className="p-3 text-right font-semibold text-slate-700">Avg Score</th>
                <th className="p-3 text-right font-semibold text-slate-700">GPA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summaries.map((s) => (
                <tr key={s.studentId} className="hover:bg-slate-50">
                  <td className="p-3 font-medium text-slate-900">{s.studentName}</td>
                  <td className="p-3 text-slate-500 font-mono">{s.studentNumber}</td>
                  <td className="p-3 text-right text-slate-600">{s.totalSubjects}</td>
                  <td className="p-3 text-right text-emerald-600 font-medium">{s.passedSubjects}</td>
                  <td className="p-3 text-right text-rose-600 font-medium">{s.failedSubjects}</td>
                  <td className="p-3 text-right text-slate-600">{s.averageScore?.toFixed(1) || "—"}</td>
                  <td className="p-3 text-right font-bold text-indigo-600">{s.gpa?.toFixed(2) || "—"}</td>
                </tr>
              ))}
              {summaries.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">No performance data found for the selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}