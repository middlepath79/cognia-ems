"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { changeExaminationStatus, createExamination, type ExamState } from "./actions";

type IdName = { id: string; name: string };
type Exam = {
  id: string; name: string; examination_type: string; assessment_model: string;
  academic_session_id: string; academic_term_id: string; class_id: string | null;
  class_arm_id: string | null; subject_id: string; programme_id: string | null;
  academic_level_id: string | null; examination_date: string | null;
  starts_at: string | null; ends_at: string | null; venue: string | null;
  maximum_marks: number; contribution_weight: number; status: string;
};
const initial: ExamState = {};

export default function ExaminationManager(props: {
  role: string; institutionType: string;
  sessions: (IdName & { is_active: boolean })[];
  terms: (IdName & { academic_session_id: string; is_active: boolean })[];
  classes: IdName[]; arms: (IdName & { class_id: string })[];
  subjects: (IdName & { code: string | null; is_active: boolean; programme_id: string | null; academic_level_id: string | null })[];
  programmes: (IdName & { is_active: boolean })[];
  levels: (IdName & { programme_id: string; is_active: boolean })[];
  assignments: { assignment_type: string; academic_session_id: string; class_id: string | null; class_arm_id: string | null; subject_id: string | null }[];
  examinations: Exam[]; subjectLabels: (IdName & { code: string | null })[];
}) {
  const isBasic = ["early_childhood", "basic", "secondary"].includes(props.institutionType);
  const [createState, createAction, creating] = useActionState(createExamination, initial);
  const [model, setModel] = useState(isBasic ? "class" : "course");
  const [programme, setProgramme] = useState("");
  const [level, setLevel] = useState("");
  const [session, setSession] = useState(props.sessions.find(x => x.is_active)?.id ?? "");
  const [classId, setClassId] = useState("");
  const [search, setSearch] = useState("");
  const [filterSession, setFilterSession] = useState("");
  const visible = useMemo(() => props.examinations.filter(exam =>
    (!search || `${exam.name} ${exam.examination_type}`.toLowerCase().includes(search.toLowerCase())) &&
    (!filterSession || exam.academic_session_id === filterSession)), [props.examinations, search, filterSession]);
  const assigned = (exam: Exam) => props.assignments.some(a => a.academic_session_id === exam.academic_session_id &&
    (exam.assessment_model === "class" ? a.assignment_type === "class" && a.class_id === exam.class_id && (!a.class_arm_id || a.class_arm_id === exam.class_arm_id) : a.assignment_type === "course" && a.subject_id === exam.subject_id));
  const terms = props.terms.filter(term => term.academic_session_id === session);
  const arms = props.arms.filter(arm => arm.class_id === classId);
  const levels = props.levels.filter(item => item.programme_id === programme);
  const subjects = props.subjects.filter(subject => model === "class" || ((!subject.programme_id || subject.programme_id === programme) && (!subject.academic_level_id || subject.academic_level_id === level)));

  return <>
    <section className="card mb-5 overflow-hidden">
      <div className="border-b border-slate-100 p-5">
        <h2 className="text-sm font-bold">Examination register</h2>
        <p className="mt-1 text-xs text-slate-500">Examinations follow the institution’s class or programme structure. Timetable setup is optional.</p>
      </div>
      <div className="flex flex-wrap gap-2 p-4">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search examination name or type" className="min-w-52 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <select value={filterSession} onChange={e => setFilterSession(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">All sessions</option>{props.sessions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>
      {visible.filter(exam => props.role === "school_admin" || assigned(exam)).length ? <div className="divide-y divide-slate-100">
        {visible.filter(exam => props.role === "school_admin" || assigned(exam)).map(exam => <article key={exam.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <h3 className="font-semibold text-slate-800">{exam.name}</h3>
            <p className="mt-1 text-xs text-slate-500">{exam.examination_type} · {props.subjectLabels.find(subject => subject.id === exam.subject_id)?.name ?? "Subject"} · {exam.examination_date ?? "Date not set"}{exam.starts_at ? ` · ${exam.starts_at.slice(0, 5)}–${exam.ends_at?.slice(0, 5)}` : ""}{exam.venue ? ` · ${exam.venue}` : ""}</p>
            <p className="mt-1 text-xs text-slate-500">Maximum {exam.maximum_marks} · {exam.contribution_weight} final-result points · <span className="capitalize">{exam.status}</span></p>
          </div>
          <div className="flex items-center gap-3">
            <Link className="text-sm font-semibold text-indigo-700" href={`/admin/examinations/${exam.id}`}>Details & marks</Link>
            {props.role === "school_admin" && exam.status === "draft" && <Status id={exam.id} status="published" />}
            {props.role === "school_admin" && exam.status === "published" && <Status id={exam.id} status="closed" />}
            {props.role === "school_admin" && exam.status !== "archived" && <Status id={exam.id} status="archived" />}
          </div>
        </article>)}
      </div> : <p className="p-7 text-center text-sm text-slate-500">No examinations match this filter.</p>}
    </section>

    {props.role === "school_admin" && <section className="card p-5">
      <h2 className="text-sm font-bold">New examination</h2>
      <form action={createAction} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs">Academic model
          <select name="model" value={model} onChange={e => setModel(e.target.value)} className="rounded border border-slate-200 p-2">
            {props.institutionType === "mixed" ? <><option value="class">Class / subject</option><option value="course">Programme / course</option></> : <option value={isBasic ? "class" : "course"}>{isBasic ? "Class / subject" : "Programme / course"}</option>}
          </select>
        </label>
        <label className="grid gap-1 text-xs">Session
          <select name="session" value={session} onChange={e => setSession(e.target.value)} required className="rounded border border-slate-200 p-2">
            <option value="">Select</option>{props.sessions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs">Academic period
          <select name="term" required className="rounded border border-slate-200 p-2">
            <option value="">Select</option>{terms.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs">Examination name<input name="name" required maxLength={160} placeholder="End of term examination" className="rounded border border-slate-200 p-2" /></label>
        <label className="grid gap-1 text-xs">Type<input name="type" required maxLength={60} placeholder="Final examination" className="rounded border border-slate-200 p-2" /></label>
        {isBasic ? <>
          <label className="grid gap-1 text-xs">Class
            <select name="classId" required value={classId} onChange={e => setClassId(e.target.value)} className="rounded border border-slate-200 p-2"><option value="">Select</option>{props.classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          </label>
          <label className="grid gap-1 text-xs">Class arm
            <select name="arm" required className="rounded border border-slate-200 p-2"><option value="">Select</option>{arms.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          </label>
        </> : <>
          <label className="grid gap-1 text-xs">Programme
            <select name="programme" required value={programme} onChange={e => { setProgramme(e.target.value); setLevel(""); }} className="rounded border border-slate-200 p-2"><option value="">Select</option>{props.programmes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          </label>
          <label className="grid gap-1 text-xs">Academic level
            <select name="level" required value={level} onChange={e => setLevel(e.target.value)} className="rounded border border-slate-200 p-2"><option value="">Select</option>{levels.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          </label>
        </>}
        <label className="grid gap-1 text-xs">Subject / course
          <select name="subject" required className="rounded border border-slate-200 p-2"><option value="">Select</option>{subjects.map(item => <option key={item.id} value={item.id}>{item.code ? `${item.code} · ` : ""}{item.name}</option>)}</select>
        </label>
        <label className="grid gap-1 text-xs">Maximum examination marks<input name="maximum" type="number" min="0.01" step="0.01" required className="rounded border border-slate-200 p-2" /></label>
        <label className="grid gap-1 text-xs">Final-result contribution points<input name="contributionWeight" type="number" min="0" step="0.001" required defaultValue="0" className="rounded border border-slate-200 p-2" /><span className="text-[11px] text-slate-500">Must sum to the institution examination contribution maximum for this course and period.</span></label>
        <label className="grid gap-1 text-xs">Date<input name="date" type="date" className="rounded border border-slate-200 p-2" /></label>
        <label className="grid gap-1 text-xs">Start time<input name="start" type="time" className="rounded border border-slate-200 p-2" /></label>
        <label className="grid gap-1 text-xs">End time<input name="end" type="time" className="rounded border border-slate-200 p-2" /></label>
        <label className="grid gap-1 text-xs">Venue<input name="venue" maxLength={160} placeholder="Optional" className="rounded border border-slate-200 p-2" /></label>
        <label className="grid gap-1 text-xs sm:col-span-2">Instructions<textarea name="instructions" maxLength={10000} rows={3} className="rounded border border-slate-200 p-2" /></label>
        <button disabled={creating} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2">{creating ? "Saving…" : "Save examination draft"}</button>
        {(createState.error || createState.success) && <p role={createState.error ? "alert" : "status"} className={`text-sm sm:col-span-2 ${createState.error ? "text-rose-700" : "text-emerald-700"}`}>{createState.error ?? createState.success}</p>}
      </form>
    </section>}
  </>;
}

function Status({ id, status }: { id: string; status: string }) {
  const [state, action, pending] = useActionState(changeExaminationStatus, initial);
  return <form action={action} onSubmit={event => {
    const message = status === "published" ? "Publish examination information to eligible students?" : status === "closed" ? "Close this examination?" : "Archive this examination? Historical results remain available.";
    if (!window.confirm(message)) event.preventDefault();
  }}>
    <input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={status} />
    <button disabled={pending} className="text-sm font-semibold text-slate-600">{pending ? "Saving…" : status}</button>
    {(state.error || state.success) && <p role={state.error ? "alert" : "status"} className="text-xs">{state.error ?? state.success}</p>}
  </form>;
}
