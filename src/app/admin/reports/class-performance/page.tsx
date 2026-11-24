import PageHeading from "@/components/page-heading";
import CsvDownload from "@/components/csv-download";
import { getCurrentSchool } from "@/lib/current-school";
import { createClient } from "@/lib/supabase/server";

interface ReportFilters {
  sessionId?: string;
  termId?: string;
}

interface FilterOptions {
  sessions: { id: string; name: string }[];
  terms: { id: string; name: string }[];
}

interface ClassInfo {
  id: string;
  name: string;
  level: string | null;
  arm: string | null;
  programme: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  faculty: { id: string; name: string } | null;
}

interface ResultRow {
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
  subject: { id: string; name: string; code: string | null; credits?: number | null } | null;
}

interface ClassSummary {
  classId: string;
  className: string | null;
  level: string | null;
  arm: string | null;
  programme: string | null;
  department: string | null;
  faculty: string | null;
  studentCount: number;
  totalSubjects: number;
  passedSubjects: number;
  failedSubjects: number;
  averageScore: number | null;
  averageGpa: number | null;
}

async function getFilterOptions(schoolId: string): Promise<FilterOptions> {
  const supabase = await createClient();
  const [{ data: sessions }, { data: terms }] = await Promise.all([
    supabase.from("academic_sessions").select("id,name").eq("school_id", schoolId).order("start_date", { ascending: false }),
    supabase.from("academic_terms").select("id,name").eq("school_id", schoolId).order("created_at", { ascending: false }),
  ]);
  return { sessions: sessions || [], terms: terms || [] };
}

async function getClassPerformance(schoolId: string, filters: ReportFilters): Promise<ClassSummary[]> {
  const supabase = await createClient();

  let enrolmentQuery = supabase
    .from("student_enrolments")
    .select(`
      id,
      student_id,
      class_id,
      session_id,
      term_id,
      class:classes!inner(id, name, level, arm, programme:programmes(id,name), department:departments(id,name), faculty:faculties(id,name)),
      student:students!inner(id, student_number, first_name, middle_name, surname)
    `)
    .eq("school_id", schoolId)
    .eq("is_active", true);

  if (filters.sessionId) enrolmentQuery = enrolmentQuery.eq("session_id", filters.sessionId);
  if (filters.termId) enrolmentQuery = enrolmentQuery.eq("term_id", filters.termId);

  const { data: enrolments, error: enrolmentError } = await enrolmentQuery;
  if (enrolmentError) throw enrolmentError;

  const studentIds = [...new Set(enrolments?.map((e) => e.student_id) || [])];
  const classIds = [...new Set(enrolments?.map((e) => e.class_id) || [])];

  let resultsResponse: { data: unknown[] | null; error: unknown } = { data: [], error: null };
  if (studentIds.length > 0) {
    let resultsQuery = supabase
      .from("academic_period_results")
      .select("id,student_id,subject_id,academic_session_id,academic_term_id,ca_contribution,examination_contribution,final_total,grade,grade_point,subject:subjects!inner(id,name,code,credits)")
      .eq("school_id", schoolId)
      .in("student_id", studentIds);
    if (filters.sessionId) resultsQuery = resultsQuery.eq("academic_session_id", filters.sessionId);
    if (filters.termId) resultsQuery = resultsQuery.eq("academic_term_id", filters.termId);
    resultsResponse = await resultsQuery;
  }
  const classesResponse = await supabase
    .from("classes")
    .select("id,name,level,arm,programme:programmes(id,name),department:departments(id,name),faculty:faculties(id,name)")
    .eq("school_id", schoolId)
    .in("id", classIds);
  const results = resultsResponse.data as unknown as ResultRow[] | null;
  const classes = classesResponse.data;
  if (resultsResponse.error) throw resultsResponse.error;
  if (classesResponse.error) throw classesResponse.error;

  const classMap = new Map<string, ClassInfo>(
    ((classes || []) as unknown as ClassInfo[]).map((c) => [c.id, c])
  );
  const resultsByClass = new Map<string, ResultRow[]>();

  (enrolments || []).forEach((e) => {
    if (!resultsByClass.has(e.class_id)) resultsByClass.set(e.class_id, []);
  });

  (results || []).forEach((r) => {
    const enrolment = enrolments?.find((e) => e.student_id === r.student_id && e.session_id === r.session_id && e.term_id === r.term_id);
    if (enrolment) {
      const classResults = resultsByClass.get(enrolment.class_id) || [];
      classResults.push(r);
      resultsByClass.set(enrolment.class_id, classResults);
    }
  });

  const summaries = Array.from(resultsByClass.entries()).map(([classId, classResults]) => {
    const classInfo = classMap.get(classId);
    const validResults = classResults.filter((r) => r.final_total !== null && r.grade_point !== null);
    const studentCount = new Set(classResults.map((r) => r.student_id)).size;
    const totalCredits = validResults.reduce((sum, r) => sum + (r.subject?.credits || 3), 0);
    const totalPoints = validResults.reduce((sum, r) => sum + (r.grade_point || 0) * (r.subject?.credits || 3), 0);
    const avgGpa = totalCredits > 0 ? totalPoints / totalCredits : null;
    const passCount = validResults.filter((r) => (r.grade_point || 0) >= 1).length;
    const failCount = validResults.filter((r) => (r.grade_point || 0) < 1).length;
    const avgScore = validResults.length > 0 ? validResults.reduce((s, r) => s + (r.final_total || 0), 0) / validResults.length : null;

    return {
      classId,
      className: classInfo?.name ?? null,
      level: classInfo?.level ?? null,
      arm: classInfo?.arm ?? null,
      programme: classInfo?.programme?.name ?? null,
      department: classInfo?.department?.name ?? null,
      faculty: classInfo?.faculty?.name ?? null,
      studentCount,
      totalSubjects: classResults.length,
      passedSubjects: passCount,
      failedSubjects: failCount,
      averageScore: avgScore,
      averageGpa: avgGpa,
    };
  });

  return summaries.sort((a, b) => (b.averageGpa || 0) - (a.averageGpa || 0));
}

function generateCSV(summaries: ClassSummary[]) {
  const headers = [
    "Class",
    "Level",
    "Arm",
    "Programme",
    "Department",
    "Students",
    "Total Subjects",
    "Passed",
    "Failed",
    "Avg Score",
    "Avg GPA",
  ];
  const rows = summaries.map((s) => [
    s.className,
    s.level || "—",
    s.arm || "—",
    s.programme || "—",
    s.department || "—",
    s.studentCount,
    s.totalSubjects,
    s.passedSubjects,
    s.failedSubjects,
    s.averageScore?.toFixed(2) || "—",
    s.averageGpa?.toFixed(2) || "—",
  ]);
  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export default async function ClassPerformanceReportPage({
  searchParams,
}: {
  searchParams: Promise<ReportFilters>;
}) {
  const { school } = await getCurrentSchool();
  const filters = await searchParams;
  const options = await getFilterOptions(school.id);
  const summaries = await getClassPerformance(school.id, filters);

  return (
    <>
      <PageHeading
        title="Class Performance Summary"
        description="Aggregate performance metrics by class, arm, and programme."
        action={
          <CsvDownload csv={generateCSV(summaries)} filename={`class-performance-${new Date().toISOString().slice(0, 10)}.csv`} disabled={summaries.length === 0} />
        }
      />

      <section className="card p-5 mb-6">
        <form method="get" className="grid gap-4 sm:grid-cols-3">
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
          <button type="submit" className="btn btn-primary self-end">Apply filters</button>
        </form>
      </section>

      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        <div className="card p-4"><p className="text-sm text-slate-500">Classes</p><p className="text-2xl font-bold text-slate-900">{summaries.length}</p></div>
        <div className="card p-4"><p className="text-sm text-slate-500">Total Students</p><p className="text-2xl font-bold text-slate-900">{summaries.reduce((s, a) => s + a.studentCount, 0)}</p></div>
        <div className="card p-4"><p className="text-sm text-slate-500">Overall Avg GPA</p><p className="text-2xl font-bold text-indigo-600">
          {summaries.length > 0 ? (summaries.reduce((s, a) => s + (a.averageGpa || 0), 0) / summaries.length).toFixed(2) : "—"}
        </p></div>
        <div className="card p-4"><p className="text-sm text-slate-500">Total Subjects</p><p className="text-2xl font-bold text-slate-900">{summaries.reduce((s, a) => s + a.totalSubjects, 0)}</p></div>
      </div>

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-3 text-left font-semibold text-slate-700">Class</th>
                <th className="p-3 text-left font-semibold text-slate-700">Level / Arm</th>
                <th className="p-3 text-left font-semibold text-slate-700">Programme / Dept</th>
                <th className="p-3 text-right font-semibold text-slate-700">Students</th>
                <th className="p-3 text-right font-semibold text-slate-700">Subjects</th>
                <th className="p-3 text-right font-semibold text-slate-700">Passed</th>
                <th className="p-3 text-right font-semibold text-slate-700">Failed</th>
                <th className="p-3 text-right font-semibold text-slate-700">Avg Score</th>
                <th className="p-3 text-right font-semibold text-slate-700">Avg GPA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summaries.map((s) => (
                <tr key={s.classId} className="hover:bg-slate-50">
                  <td className="p-3 font-medium text-slate-900">{s.className}</td>
                  <td className="p-3 text-slate-600">{s.level || "—"} {s.arm ? `(${s.arm})` : ""}</td>
                  <td className="p-3 text-slate-600">{s.programme || "—"} / {s.department || "—"}</td>
                  <td className="p-3 text-right text-slate-600">{s.studentCount}</td>
                  <td className="p-3 text-right text-slate-600">{s.totalSubjects}</td>
                  <td className="p-3 text-right text-emerald-600 font-medium">{s.passedSubjects}</td>
                  <td className="p-3 text-right text-rose-600 font-medium">{s.failedSubjects}</td>
                  <td className="p-3 text-right text-slate-600">{s.averageScore?.toFixed(1) || "—"}</td>
                  <td className="p-3 text-right font-bold text-indigo-600">{s.averageGpa?.toFixed(2) || "—"}</td>
                </tr>
              ))}
              {summaries.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">No class performance data found for the selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}