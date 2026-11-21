"use client";

import { useActionState } from "react";
import {
  deleteSessionAction, deleteTermAction, saveSessionAction, saveTermAction,
  setActiveSessionAction, setActiveTermAction, type AcademicActionState,
} from "./actions";

type Session = { id: string; name: string; starts_on: string; ends_on: string; is_active: boolean };
type Term = { id: string; academic_session_id: string; name: string; starts_on: string; ends_on: string; is_active: boolean };

function ResultMessage({ state }: { state: AcademicActionState }) {
  if (state.error) return <p role="alert" className="mt-3 text-sm text-rose-700">{state.error}</p>;
  if (state.success) return <p role="status" className="mt-3 text-sm text-emerald-700">{state.success}</p>;
  return null;
}

function SessionRow({ session }: { session: Session }) {
  const [editState, editAction, editing] = useActionState(saveSessionAction, {});
  const [activeState, activeAction, activating] = useActionState(setActiveSessionAction, {});
  const [deleteState, deleteAction, deleting] = useActionState(deleteSessionAction, {});
  return <article className="rounded-xl border border-slate-200 p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{session.name}</h3>{session.is_active && <span className="pill bg-emerald-50 text-emerald-700">Active session</span>}</div><p className="mt-1 text-sm text-slate-500">{session.starts_on} to {session.ends_on}</p></div>
      {!session.is_active && <form action={activeAction}><input type="hidden" name="id" value={session.id}/><button disabled={activating} className="rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700 disabled:opacity-60">{activating ? "Updating…" : "Set active"}</button></form>}
    </div>
    <ResultMessage state={activeState}/>
    <details className="mt-4 border-t border-slate-100 pt-3"><summary className="cursor-pointer text-xs font-semibold text-slate-600">Edit session</summary>
      <form action={editAction} className="mt-4 grid gap-3 sm:grid-cols-4"><input type="hidden" name="id" value={session.id}/><label className="text-xs font-medium text-slate-600 sm:col-span-2">Session name<input name="name" defaultValue={session.name} required maxLength={32} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label><label className="text-xs font-medium text-slate-600">Opens<input type="date" name="startsOn" defaultValue={session.starts_on} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label><label className="text-xs font-medium text-slate-600">Closes<input type="date" name="endsOn" defaultValue={session.ends_on} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label><div className="sm:col-span-4"><button disabled={editing} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{editing ? "Saving…" : "Save changes"}</button><ResultMessage state={editState}/></div></form>
      <div className="mt-3"><DeleteSessionButton action={deleteAction} deleting={deleting} session={session}/><ResultMessage state={deleteState}/></div>
    </details>
  </article>;
}

function DeleteSessionButton({ action, deleting, session }: { action: (formData: FormData) => void; deleting: boolean; session: Session }) {
  return <form action={action} onSubmit={(event) => { const hasTerms = document.querySelector(`[data-session-terms="${session.id}"]`) !== null; const detail = hasTerms ? " All terms in this session will also be permanently deleted." : ""; if (!window.confirm(`Delete ${session.name}?${detail}`)) event.preventDefault(); }}><input type="hidden" name="id" value={session.id}/><button disabled={deleting} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60">{deleting ? "Deleting…" : "Delete session"}</button></form>;
}

function TermRow({ term, sessions }: { term: Term; sessions: Session[] }) {
  const [editState, editAction, editing] = useActionState(saveTermAction, {});
  const [activeState, activeAction, activating] = useActionState(setActiveTermAction, {});
  const [deleteState, deleteAction, deleting] = useActionState(deleteTermAction, {});
  const session = sessions.find((item) => item.id === term.academic_session_id);
  return <article data-session-terms={term.academic_session_id} className="rounded-xl border border-slate-200 p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{term.name}</h3>{term.is_active && <span className="pill bg-emerald-50 text-emerald-700">Active period</span>}</div><p className="mt-1 text-sm text-slate-500">{session?.name ?? "Session unavailable"} · {term.starts_on} to {term.ends_on}</p></div>
      {!term.is_active && session?.is_active && <form action={activeAction}><input type="hidden" name="id" value={term.id}/><button disabled={activating} className="rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700 disabled:opacity-60">{activating ? "Updating…" : "Set active"}</button></form>}
    </div>
    <ResultMessage state={activeState}/>
    <details className="mt-4 border-t border-slate-100 pt-3"><summary className="cursor-pointer text-xs font-semibold text-slate-600">Edit academic period</summary>
      <form action={editAction} className="mt-4 grid gap-3 sm:grid-cols-4"><input type="hidden" name="id" value={term.id}/><label className="text-xs font-medium text-slate-600 sm:col-span-2">Session<select name="sessionId" defaultValue={term.academic_session_id} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">{sessions.map((item) => <option value={item.id} key={item.id}>{item.name}{item.is_active ? " · Active session" : ""}</option>)}</select></label><label className="text-xs font-medium text-slate-600">Period name<input name="name" defaultValue={term.name} required maxLength={48} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label><span/><label className="text-xs font-medium text-slate-600">Opens<input type="date" name="startsOn" defaultValue={term.starts_on} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label><label className="text-xs font-medium text-slate-600">Closes<input type="date" name="endsOn" defaultValue={term.ends_on} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label><div className="sm:col-span-4"><button disabled={editing} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{editing ? "Saving…" : "Save changes"}</button><ResultMessage state={editState}/></div></form>
      <form action={deleteAction} className="mt-3" onSubmit={(event) => { if (!window.confirm(`Permanently delete ${term.name} from ${session?.name ?? "this session"}?`)) event.preventDefault(); }}><input type="hidden" name="id" value={term.id}/><button disabled={deleting} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60">{deleting ? "Deleting…" : "Delete period"}</button><ResultMessage state={deleteState}/></form>
    </details>
  </article>;
}

export default function AcademicManager({ sessions, terms }: { sessions: Session[]; terms: Term[] }) {
  const [createState, createAction, creating] = useActionState(saveSessionAction, {});
  const [termState, termAction, creatingTerm] = useActionState(saveTermAction, {});
  const activeSession = sessions.find((session) => session.is_active);
  return <div className="space-y-8">
    <section className="card p-5 sm:p-6"><h2 className="text-base font-bold text-slate-900">Academic sessions</h2><p className="mt-1 text-sm text-slate-500">Create school years and set the one session currently in progress.</p>
      <form action={createAction} className="mt-5 grid gap-3 sm:grid-cols-4"><label className="text-sm font-medium text-slate-700 sm:col-span-2">Session name<input name="name" placeholder="2026/2027" required minLength={4} maxLength={32} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"/></label><label className="text-sm font-medium text-slate-700">Opening date<input type="date" name="startsOn" required className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"/></label><label className="text-sm font-medium text-slate-700">Closing date<input type="date" name="endsOn" required className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"/></label><div className="sm:col-span-4"><button disabled={creating} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{creating ? "Creating…" : "Create session"}</button><ResultMessage state={createState}/></div></form>
      <div className="mt-6 space-y-3">{sessions.length ? sessions.map((session) => <SessionRow key={session.id} session={session}/>) : <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No sessions have been created for this school.</p>}</div>
    </section>

    <section className="card p-5 sm:p-6"><h2 className="text-base font-bold text-slate-900">Academic periods</h2><p className="mt-1 text-sm text-slate-500">Configure the periods used by this institution, such as terms, semesters, trimesters or quarters.</p>
      <form action={termAction} className="mt-5 grid gap-3 sm:grid-cols-4"><label className="text-sm font-medium text-slate-700 sm:col-span-2">Academic session<select name="sessionId" required defaultValue="" className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal"><option value="" disabled>Select a session</option>{sessions.map((session) => <option key={session.id} value={session.id}>{session.name}{session.is_active ? " · Active" : ""}</option>)}</select></label><label className="text-sm font-medium text-slate-700">Period name<input name="name" required maxLength={48} placeholder="Semester 1" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"/></label><span/><label className="text-sm font-medium text-slate-700">Opening date<input type="date" name="startsOn" required className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"/></label><label className="text-sm font-medium text-slate-700">Closing date<input type="date" name="endsOn" required className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"/></label><div className="sm:col-span-4"><button disabled={creatingTerm || !sessions.length} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{creatingTerm ? "Creating…" : "Create period"}</button><ResultMessage state={termState}/></div></form>
      {activeSession && <p className="mt-4 rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-800">Current session: <strong>{activeSession.name}</strong>{terms.some((term) => term.academic_session_id === activeSession.id && term.is_active) ? ` · Active term: ${terms.find((term) => term.academic_session_id === activeSession.id && term.is_active)?.name}` : " · No active term selected"}</p>}
      <div className="mt-6 space-y-3">{terms.length ? terms.map((term) => <TermRow key={term.id} term={term} sessions={sessions}/>) : <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No terms have been created yet.</p>}</div>
    </section>
  </div>;
}
