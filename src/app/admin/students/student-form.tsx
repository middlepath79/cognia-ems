"use client";

import { useActionState } from "react";
import { saveStudentAction, type StudentActionState } from "./actions";

const input = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
type Student = { id: string; student_number: string; first_name: string; middle_name: string | null; surname: string; date_of_birth: string | null; gender: string | null; email: string | null; phone: string | null; residential_address: string | null; admission_date: string; status: string };
export default function StudentForm({ student }: { student?: Student }) {
  const [state, action, pending] = useActionState<StudentActionState, FormData>(saveStudentAction, {});
  const field = (label: string, name: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => <label className="grid gap-1.5 text-xs font-semibold text-slate-600">{label}<input className={input} name={name} {...props}/></label>;
  return <form action={action} className="card grid gap-5 p-5 sm:grid-cols-2 sm:p-7">
    {student && <><input type="hidden" name="id" value={student.id}/><div className="sm:col-span-2 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">Student ID <strong className="ml-2 text-slate-900">{student.student_number}</strong></div></>}
    <div className="sm:col-span-2"><h2 className="text-sm font-bold text-slate-900">Personal information</h2><p className="mt-1 text-xs text-slate-500">Enter the student&apos;s legal name and contact details.</p></div>
    {field("First name", "firstName", { required: true, maxLength: 100, defaultValue: student?.first_name })}
    {field("Middle name", "middleName", { maxLength: 100, defaultValue: student?.middle_name ?? "" })}
    {field("Surname", "surname", { required: true, maxLength: 100, defaultValue: student?.surname })}
    {field("Date of birth", "dateOfBirth", { type: "date", defaultValue: student?.date_of_birth ?? "" })}
    <label className="grid gap-1.5 text-xs font-semibold text-slate-600">Gender{<select className={input} name="gender" defaultValue={student?.gender ?? ""}><option value="">Not recorded</option><option>Female</option><option>Male</option><option>Non-binary</option><option>Prefer not to say</option></select>}</label>
    {field("Email", "email", { type: "email", maxLength: 254, defaultValue: student?.email ?? "" })}
    {field("Phone", "phone", { type: "tel", maxLength: 40, defaultValue: student?.phone ?? "" })}
    {field("Admission date", "admissionDate", { type: "date", required: true, defaultValue: student?.admission_date ?? new Date().toISOString().slice(0, 10) })}
    <label className="grid gap-1.5 text-xs font-semibold text-slate-600">Student status<select className={input} name="status" defaultValue={student?.status ?? "active"}>{["applicant", "admitted", "active", "deferred", "suspended", "withdrawn", "graduated"].map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}</select></label>
    <label className="grid gap-1.5 text-xs font-semibold text-slate-600 sm:col-span-2">Residential address<textarea className={input} name="address" maxLength={500} rows={3} defaultValue={student?.residential_address ?? ""}/></label>
    <div className="sm:col-span-2 flex flex-wrap items-center gap-3"><button disabled={pending} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{pending ? "Saving…" : student ? "Save changes" : "Create student"}</button>{state.error && <p role="alert" className="text-sm text-rose-700">{state.error}</p>}{state.success && <p role="status" className="text-sm text-emerald-700">{state.success}</p>}</div>
  </form>;
}
