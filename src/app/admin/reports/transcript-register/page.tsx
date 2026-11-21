import { CheckCircle, XCircle } from "lucide-react";
import PageHeading from "@/components/page-heading";
import CsvDownload from "@/components/csv-download";
import { getCurrentSchool } from "@/lib/current-school";
import { createClient } from "@/lib/supabase/server";

interface ReportFilters {
  sessionId?: string;
  termId?: string;
  status?: "all" | "active" | "voided";
  studentId?: string;
}

interface FilterOptions {
  sessions: { id: string; name: string }[];
  terms: { id: string; name: string }[];
}

interface TranscriptSnapshot {
  results?: unknown[];
  gpa?: unknown[];
}

interface TranscriptRecord {
  id: string;
  reference: string;
  studentId: string | null;
  studentNumber: string | null;
  studentName: string;
  issuedAt: string | null;
  voidedAt: string | null;
  isVoided: boolean;
  snapshot: TranscriptSnapshot | null;
}

async function getFilterOptions(schoolId: string): Promise<FilterOptions> {
  const supabase = await createClient();
  const [{ data: sessions }, { data: terms }] = await Promise.all([
    supabase.from("academic_sessions").select("id,name").eq("school_id", schoolId).order("start_date", { ascending: false }),
    supabase.from("academic_terms").select("id,name").eq("school_id", schoolId).order("created_at", { ascending: false }),
  ]);
  return { sessions: sessions || [], terms: terms || [] };
}

async function getTranscriptRegister(schoolId: string, filters: ReportFilters): Promise<TranscriptRecord[]> {
  const supabase = await createClient();

  let query = supabase
    .from("transcript_issues")
    .select(`
      id,
      transcript_reference,
      transcript_snapshot,
      issued_at,
      voided_at,
      student:students!inner(id, student_number, first_name, middle_name, surname)
    `)
    .eq("school_id", schoolId)
    .order("issued_at", { ascending: false });

  if (filters.status === "active") query = query.is("voided_at", null);
  if (filters.status === "voided") query = query.not("voided_at", "is", null);
  if (filters.studentId) query = query.eq("student_id", filters.studentId);

  const { data, error } = await query;
  if (error) throw error;

  return ((data || []) as unknown as { id: string; transcript_reference: string; transcript_snapshot: TranscriptSnapshot | null; issued_at: string; voided_at: string | null; student: { id: string; student_number: string; first_name: string; middle_name: string | null; surname: string } }[]).map((t) => ({
    id: t.id,
    reference: t.transcript_reference,
    studentId: t.student?.id,
    studentNumber: t.student?.student_number,
    studentName: [t.student?.first_name, t.student?.middle_name, t.student?.surname].filter(Boolean).join(" "),
    issuedAt: t.issued_at,
    voidedAt: t.voided_at,
    isVoided: !!t.voided_at,
    snapshot: t.transcript_snapshot,
  }));
}

function generateCSV(transcripts: TranscriptRecord[]) {
  const headers = [
    "Reference",
    "Student Number",
    "Student Name",
    "Issued Date",
    "Status",
    "Voided Date",
    "Subjects Count",
    "GPA Records",
  ];
  const rows = transcripts.map((t) => [
    t.reference,
    t.studentNumber,
    t.studentName,
    t.issuedAt ? new Date(t.issuedAt).toLocaleDateString() : "—",
    t.isVoided ? "Voided" : "Active",
    t.voidedAt ? new Date(t.voidedAt).toLocaleDateString() : "—",
    t.snapshot?.results?.length || 0,
    t.snapshot?.gpa?.length || 0,
  ]);
  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export default async function TranscriptRegisterReportPage({
  searchParams,
}: {
  searchParams: Promise<ReportFilters>;
}) {
  const { school } = await getCurrentSchool();
  const filters = await searchParams;
  const options = await getFilterOptions(school.id);
  const transcripts = await getTranscriptRegister(school.id, filters);

  const activeCount = transcripts.filter((t) => !t.isVoided).length;
  const voidedCount = transcripts.filter((t) => t.isVoided).length;

  return (
    <>
      <PageHeading
        title="Transcript Register"
        description="All issued transcripts with verification status and student details."
        action={
          <CsvDownload csv={generateCSV(transcripts)} filename={`transcript-register-${new Date().toISOString().slice(0, 10)}.csv`} disabled={transcripts.length === 0} />
        }
      />

      <section className="card p-5 mb-6">
        <form method="get" className="grid gap-4 sm:grid-cols-4">
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
            name="status"
            defaultValue={filters.status || "all"}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="voided">Voided</option>
          </select>
          <button type="submit" className="btn btn-primary self-end">Apply filters</button>
        </form>
      </section>

      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        <div className="card p-4"><p className="text-sm text-slate-500">Total Transcripts</p><p className="text-2xl font-bold text-slate-900">{transcripts.length}</p></div>
        <div className="card p-4"><p className="text-sm text-slate-500">Active</p><p className="text-2xl font-bold text-emerald-600">{activeCount}</p></div>
        <div className="card p-4"><p className="text-sm text-slate-500">Voided</p><p className="text-2xl font-bold text-rose-600">{voidedCount}</p></div>
        <div className="card p-4"><p className="text-sm text-slate-500">Unique Students</p><p className="text-2xl font-bold text-indigo-600">{new Set(transcripts.map((t) => t.studentId)).size}</p></div>
      </div>

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-3 text-left font-semibold text-slate-700">Reference</th>
                <th className="p-3 text-left font-semibold text-slate-700">Student</th>
                <th className="p-3 text-left font-semibold text-slate-700">Student ID</th>
                <th className="p-3 text-left font-semibold text-slate-700">Issued</th>
                <th className="p-3 text-center font-semibold text-slate-700">Status</th>
                <th className="p-3 text-left font-semibold text-slate-700">Voided</th>
                <th className="p-3 text-right font-semibold text-slate-700">Subjects</th>
                <th className="p-3 text-right font-semibold text-slate-700">GPA Records</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transcripts.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="p-3 font-mono text-sm text-indigo-700">{t.reference}</td>
                  <td className="p-3 font-medium text-slate-900">{t.studentName}</td>
                  <td className="p-3 text-slate-500">{t.studentNumber}</td>
                  <td className="p-3 text-slate-600">{t.issuedAt ? new Date(t.issuedAt).toLocaleDateString() : "—"}</td>
                  <td className="p-3 text-center">
                    {t.isVoided ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-700">
                        <XCircle size={10} /> Voided
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                        <CheckCircle size={10} /> Active
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-slate-600">{t.voidedAt ? new Date(t.voidedAt).toLocaleDateString() : "—"}</td>
                  <td className="p-3 text-right text-slate-600">{t.snapshot?.results?.length || 0}</td>
                  <td className="p-3 text-right text-slate-600">{t.snapshot?.gpa?.length || 0}</td>
                </tr>
              ))}
              {transcripts.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">No transcripts found for the selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}