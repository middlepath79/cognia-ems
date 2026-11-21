import Link from "next/link";
import { Plus, Search, ChevronLeft, ChevronRight, GraduationCap } from "lucide-react";
import PageHeading from "@/components/page-heading";
import { getCurrentSchool } from "@/lib/current-school";

const pageSize = 25;
type SearchParams = Promise<{ q?: string; status?: string; page?: string }>;
const statusLabels: Record<string, string> = { applicant: "Applicant", admitted: "Admitted", active: "Active", deferred: "Deferred", suspended: "Suspended", withdrawn: "Withdrawn", graduated: "Graduated" };

export default async function StudentsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams; const q = (params.q ?? "").trim().slice(0, 100); const status = params.status ?? "";
  const parsed = Number(params.page ?? 1); const page = Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
  const { supabase, school } = await getCurrentSchool();
  let query = supabase.from("students").select("id, student_number, first_name, middle_name, surname, email, phone, status, admission_date", { count: "exact" }).eq("school_id", school.id).order("surname").order("first_name").range((page - 1) * pageSize, page * pageSize - 1);
  if (statusLabels[status]) query = query.eq("status", status);
  const safeSearch = q.replace(/[,%()]/g, " ").replace(/\s+/g, " ").trim();
  if (safeSearch) query = query.or(`student_number.ilike.%${safeSearch}%,first_name.ilike.%${safeSearch}%,middle_name.ilike.%${safeSearch}%,surname.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`);
  const { data: students, count, error } = await query;
  const total = count ?? 0; const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (nextPage: number) => `/admin/students?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), page: String(nextPage) })}`;
  return <>
    <PageHeading title="Students" description={`Student directory for ${school.name}. Search, review and maintain student records.`}/>
    <div className="mb-4 flex flex-wrap gap-2"><Link href="/admin/students/new" className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"><Plus size={16}/> Register student</Link><Link href="/admin/admissions" className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Admissions</Link></div>
    <section className="card overflow-hidden">
      <form className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
        <label className="relative flex-1"><span className="sr-only">Search students</span><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input name="q" defaultValue={q} placeholder="Search name, student ID or email" className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-400"/></label>
        <select name="status" defaultValue={status} aria-label="Filter by status" className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700"><option value="">All statuses</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <button className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Search</button>
      </form>
      {error ? <div role="alert" className="p-6 text-sm text-rose-700">Student records could not be loaded. Refresh and try again.</div> : students?.length ? <>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Student</th><th className="px-5 py-3">Student ID</th><th className="px-5 py-3">Contact</th><th className="px-5 py-3">Admission date</th><th className="px-5 py-3">Status</th><th className="px-5 py-3"><span className="sr-only">Open record</span></th></tr></thead><tbody className="divide-y divide-slate-100">{students.map((student) => <tr key={student.id} className="hover:bg-slate-50/70"><td className="px-5 py-4"><Link href={`/admin/students/${student.id}`} className="font-semibold text-slate-900 hover:text-indigo-700">{student.first_name} {student.middle_name ? `${student.middle_name} ` : ""}{student.surname}</Link></td><td className="px-5 py-4 font-mono text-xs text-slate-600">{student.student_number}</td><td className="px-5 py-4 text-slate-600">{student.email ?? student.phone ?? "—"}</td><td className="px-5 py-4 text-slate-600">{new Date(`${student.admission_date}T00:00:00`).toLocaleDateString()}</td><td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-700">{student.status}</span></td><td className="px-5 py-4"><Link href={`/admin/students/${student.id}`} className="font-semibold text-indigo-700">View</Link></td></tr>)}</tbody></table></div>
        <div className="flex items-center justify-between gap-4 border-t border-slate-100 px-5 py-3 text-xs text-slate-500"><span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span><div className="flex gap-2"><Link aria-disabled={page <= 1} href={href(Math.max(1, page - 1))} className={`inline-flex items-center gap-1 rounded-md border px-3 py-2 ${page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-slate-50"}`}><ChevronLeft size={14}/>Previous</Link><Link aria-disabled={page >= pages} href={href(Math.min(pages, page + 1))} className={`inline-flex items-center gap-1 rounded-md border px-3 py-2 ${page >= pages ? "pointer-events-none opacity-40" : "hover:bg-slate-50"}`}>Next<ChevronRight size={14}/></Link></div></div>
      </> : <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center"><div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-indigo-50 text-indigo-600"><GraduationCap size={23}/></div><h2 className="font-semibold text-slate-900">{q || status ? "No matching students" : "No students yet"}</h2><p className="mt-2 max-w-md text-sm text-slate-500">{q || status ? "Try another search or clear the status filter." : "Register a student or review new applications to get started."}</p></div>}
    </section>
  </>;
}
