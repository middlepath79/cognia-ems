"use client";

import { useActionState, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addStudentDocumentAction, saveGuardianAction, savePlacementAction, saveStudentPhotoPathAction, setStudentStatusAction, type StudentActionState } from "./actions";

const input = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
const field = "grid gap-1.5 text-xs font-semibold text-slate-600";
type Pick = { id: string; name: string; is_active?: boolean };
type Session = Pick & { starts_on: string; ends_on: string };
type Term = Pick & { academic_session_id: string; is_active?: boolean };
type Arm = Pick & { class_id: string; class_name: string };
type Programme = Pick & { department_id: string | null };
type Level = Pick & { programme_id: string | null };

export function PlacementForm({ studentId, institutionType, arms, programmes, levels, sessions, terms }: { studentId: string; institutionType: string; arms: Arm[]; programmes: Programme[]; levels: Level[]; sessions: Session[]; terms: Term[] }) {
  const [state, action, pending] = useActionState<StudentActionState, FormData>(savePlacementAction, {});
  const basicOnly = ["early_childhood", "basic", "secondary"].includes(institutionType);
  const programmeOnly = ["college", "polytechnic", "monotechnic", "university", "postgraduate", "professional_research"].includes(institutionType);
  const [structure, setStructure] = useState(basicOnly ? "basic" : "programme");
  const [session, setSession] = useState("");
  const [programme, setProgramme] = useState("");
  const usableArms = arms.filter((item) => item.is_active !== false);
  const usableProgrammes = programmes.filter((item) => item.is_active !== false);
  const usableLevels = levels.filter((item) => item.is_active !== false && (!item.programme_id || item.programme_id === programme));
  const visibleTerms = terms.filter((item) => item.academic_session_id === session && item.is_active !== false);
  return <form action={action} className="grid gap-3 sm:grid-cols-2">
    <input type="hidden" name="studentId" value={studentId}/>
    {(basicOnly || programmeOnly) && <input type="hidden" name="structureType" value={basicOnly ? "basic" : "programme"}/>}
    {!basicOnly && !programmeOnly && <label className={field}>Placement structure<select className={input} name="structureType" value={structure} onChange={(event) => setStructure(event.target.value)}><option value="basic">Class and arm</option><option value="programme">Programme and level</option></select></label>}
    {(basicOnly || structure === "basic") && <label className={field}>Class and arm<select className={input} name="classArmId" required><option value="">Select class arm</option>{usableArms.map((arm) => <option key={arm.id} value={arm.id}>{arm.class_name} · {arm.name}</option>)}</select></label>}
    {(programmeOnly || structure === "programme") && <>
      <label className={field}>Programme<select className={input} name="programmeId" required value={programme} onChange={(event) => setProgramme(event.target.value)}><option value="">Select programme</option>{usableProgrammes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className={field}>Academic level<select className={input} name="academicLevelId" required><option value="">Select level</option>{usableLevels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    </>}
    <label className={field}>Academic session<select className={input} name="academicSessionId" required value={session} onChange={(event) => setSession(event.target.value)}><option value="">Select session</option>{sessions.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className={field}>Academic period<select className={input} name="academicTermId" required><option value="">Select period</option>{visibleTerms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className={field}>Placement begins<input className={input} name="startsOn" type="date" required defaultValue={new Date().toISOString().slice(0, 10)}/></label>
    <div className="sm:col-span-2 flex flex-wrap items-center gap-3"><button disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Saving…" : "Save placement"}</button>{state.error && <span role="alert" className="text-sm text-rose-700">{state.error}</span>}{state.success && <span role="status" className="text-sm text-emerald-700">{state.success}</span>}</div>
  </form>;
}

export function GuardianForm({ studentId, guardians }: { studentId: string; guardians: { id: string; first_name: string; surname: string; email: string | null; phone: string | null }[] }) {
  const [state, action, pending] = useActionState<StudentActionState, FormData>(saveGuardianAction, {});
  const [existing, setExisting] = useState("");
  const [details, setDetails] = useState({ firstName: "", surname: "", email: "", phone: "" });
  return <form action={action} className="grid gap-3 sm:grid-cols-2">
    <input type="hidden" name="studentId" value={studentId}/><label className={`${field} sm:col-span-2`}>Link an existing guardian (optional)<select className={input} value={existing} onChange={(event) => { const selected = event.target.value; const guardian = guardians.find((g) => g.id === selected); setExisting(selected); setDetails({ firstName: guardian?.first_name ?? "", surname: guardian?.surname ?? "", email: guardian?.email ?? "", phone: guardian?.phone ?? "" }); }}><option value="">Create a new guardian</option>{guardians.map((g) => <option key={g.id} value={g.id}>{g.first_name} {g.surname}</option>)}</select></label><input type="hidden" name="guardianId" value={existing}/>
    <label className={field}>First name<input className={input} name="firstName" required maxLength={100} value={details.firstName} onChange={(event) => setDetails({ ...details, firstName: event.target.value })}/></label><label className={field}>Surname<input className={input} name="surname" required maxLength={100} value={details.surname} onChange={(event) => setDetails({ ...details, surname: event.target.value })}/></label><label className={field}>Email<input className={input} name="email" type="email" maxLength={254} value={details.email} onChange={(event) => setDetails({ ...details, email: event.target.value })}/></label><label className={field}>Phone<input className={input} name="phone" type="tel" maxLength={40} value={details.phone} onChange={(event) => setDetails({ ...details, phone: event.target.value })}/></label><label className={field}>Relationship<input className={input} name="relationship" placeholder="Parent, guardian, sibling" required maxLength={48}/></label><label className="flex items-center gap-2 self-end pb-3 text-sm text-slate-700"><input name="emergency" type="checkbox" className="h-4 w-4 rounded border-slate-300"/>Emergency contact</label>
    <div className="sm:col-span-2 flex flex-wrap items-center gap-3"><button disabled={pending} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-60">{pending ? "Saving…" : "Save guardian"}</button>{state.error && <span role="alert" className="text-sm text-rose-700">{state.error}</span>}{state.success && <span role="status" className="text-sm text-emerald-700">{state.success}</span>}</div>
  </form>;
}

export function StatusForm({ studentId, status }: { studentId: string; status: string }) {
  const [state, action, pending] = useActionState<StudentActionState, FormData>(setStudentStatusAction, {});
  return <form action={action} className="flex flex-wrap items-center gap-2"><input type="hidden" name="studentId" value={studentId}/><select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" name="status" defaultValue={status}>{["applicant", "admitted", "active", "deferred", "suspended", "withdrawn", "graduated"].map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}</select><button disabled={pending} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{pending ? "Saving…" : "Update status"}</button>{state.error && <span role="alert" className="basis-full text-xs text-rose-700">{state.error}</span>}{state.success && <span role="status" className="basis-full text-xs text-emerald-700">{state.success}</span>}</form>;
}

export function DocumentUpload({ schoolId, studentId }: { schoolId: string; studentId: string }) {
  const [state, action, pending] = useActionState<StudentActionState, FormData>(addStudentDocumentAction, {});
  const [uploading, setUploading] = useState(false);
  async function upload(formData: FormData) {
    const file = formData.get("file");
    if (!(file instanceof File) || !file.size) return;
    if (file.size > 10485760 || !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      alert("Choose a PDF or image file up to 10 MB."); return;
    }
    setUploading(true);
    const path = `${schoolId}/${studentId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160)}`;
    const client = createClient();
    const result = await client.storage.from("student-records").upload(path, file, { contentType: file.type, upsert: false });
    setUploading(false);
    if (result.error) { alert("The file could not be uploaded. Check your connection and try again."); return; }
    const metadata = new FormData(); metadata.set("studentId", studentId); metadata.set("storagePath", path); metadata.set("fileName", file.name.slice(0, 200)); metadata.set("contentType", file.type); metadata.set("sizeBytes", String(file.size)); metadata.set("documentType", String(formData.get("documentType") ?? "other"));
    action(metadata);
  }
  return <form action={upload} className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className={`${field} flex-1`}>Document<input className={input} name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required/></label><label className={field}>Type<select className={input} name="documentType"><option value="other">Other</option><option value="identity">Identity</option><option value="transcript">Transcript</option><option value="medical">Medical</option><option value="consent">Consent</option></select></label><button disabled={pending || uploading} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-60">{uploading ? "Uploading…" : pending ? "Saving…" : "Upload document"}</button>{state.error && <span role="alert" className="text-sm text-rose-700">{state.error}</span>}{state.success && <span role="status" className="text-sm text-emerald-700">{state.success}</span>}</form>;
}

export function PhotoUpload({ schoolId, studentId }: { schoolId: string; studentId: string }) {
  const [state, action, pending] = useActionState<StudentActionState, FormData>(saveStudentPhotoPathAction, {});
  const [uploading, setUploading] = useState(false);
  async function upload(formData: FormData) {
    const file = formData.get("photo");
    if (!(file instanceof File) || !file.size) return;
    if (file.size > 10485760 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) { alert("Choose a JPG, PNG or WebP photograph up to 10 MB."); return; }
    setUploading(true);
    const path = `${schoolId}/${studentId}/profile-${crypto.randomUUID()}.${file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"}`;
    const client = createClient();
    const result = await client.storage.from("student-records").upload(path, file, { contentType: file.type, upsert: false });
    setUploading(false);
    if (result.error) { alert("The photograph could not be uploaded. Please try again."); return; }
    const metadata = new FormData(); metadata.set("studentId", studentId); metadata.set("storagePath", path); action(metadata);
  }
  return <form action={upload} className="mt-3 flex flex-wrap items-center gap-3"><input type="hidden" name="studentId" value={studentId}/><input aria-label="Student profile photograph" name="photo" type="file" accept="image/jpeg,image/png,image/webp" required className="max-w-full text-xs text-slate-600"/><button disabled={pending || uploading} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60">{uploading ? "Uploading…" : pending ? "Saving…" : "Update photo"}</button>{state.error && <span role="alert" className="text-xs text-rose-700">{state.error}</span>}{state.success && <span role="status" className="text-xs text-emerald-700">{state.success}</span>}</form>;
}
