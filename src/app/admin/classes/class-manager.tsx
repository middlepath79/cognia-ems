"use client";

import { useActionState } from "react";
import type { AcademicActionState } from "../academics/actions";
import { deleteClassAction, deleteClassArmAction, saveClassAction, saveClassArmAction } from "./actions";

type Arm = { id: string; class_id: string; name: string; sort_order: number };
type SchoolClass = { id: string; name: string; sort_order: number; arms: Arm[] };

function Message({ state }: { state: AcademicActionState }) {
  if (state.error) return <p role="alert" className="mt-2 text-sm text-rose-700">{state.error}</p>;
  if (state.success) return <p role="status" className="mt-2 text-sm text-emerald-700">{state.success}</p>;
  return null;
}

function ArmRow({ arm }: { arm: Arm }) {
  const [saveState, saveAction, saving] = useActionState(saveClassArmAction, {});
  const [deleteState, deleteAction, deleting] = useActionState(deleteClassArmAction, {});
  return <div className="rounded-lg border border-slate-200 p-3">
    <details><summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-slate-700"><span>Arm {arm.name}</span><span className="text-xs text-indigo-700">Edit</span></summary>
      <form action={saveAction} className="mt-3 grid gap-3 sm:grid-cols-[1fr_120px_auto]"><input type="hidden" name="id" value={arm.id}/><input type="hidden" name="classId" value={arm.class_id}/><label className="text-xs font-medium text-slate-600">Arm name<input name="name" defaultValue={arm.name} required maxLength={32} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label><label className="text-xs font-medium text-slate-600">Sort order<input name="sortOrder" type="number" min="0" max="9999" defaultValue={arm.sort_order} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label><button disabled={saving} className="self-end rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : "Save"}</button><div className="sm:col-span-3"><Message state={saveState}/></div></form>
    </details>
    <form action={deleteAction} className="mt-2" onSubmit={(event) => { if (!window.confirm(`Permanently delete arm ${arm.name}?`)) event.preventDefault(); }}><input type="hidden" name="id" value={arm.id}/><button disabled={deleting} className="text-xs font-semibold text-rose-700 disabled:opacity-60">{deleting ? "Deleting…" : "Delete arm"}</button><Message state={deleteState}/></form>
  </div>;
}

function ClassCard({ schoolClass }: { schoolClass: SchoolClass }) {
  const [editState, editAction, editing] = useActionState(saveClassAction, {});
  const [deleteState, deleteAction, deleting] = useActionState(deleteClassAction, {});
  const [armState, armAction, addingArm] = useActionState(saveClassArmAction, {});
  return <article className="card p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">{schoolClass.name}</h2><p className="mt-1 text-xs text-slate-500">{schoolClass.arms.length} class arm{schoolClass.arms.length === 1 ? "" : "s"}</p></div>
      <details><summary className="cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Edit class</summary><div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
        <form action={editAction} className="grid gap-3 sm:grid-cols-[1fr_110px_auto]"><input type="hidden" name="id" value={schoolClass.id}/><label className="text-xs font-medium text-slate-600">Class name<input name="name" defaultValue={schoolClass.name} required maxLength={60} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label><label className="text-xs font-medium text-slate-600">Sort order<input name="sortOrder" type="number" min="0" max="9999" defaultValue={schoolClass.sort_order} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label><button disabled={editing} className="self-end rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{editing ? "Saving…" : "Save"}</button><div className="sm:col-span-3"><Message state={editState}/></div></form>
        <form action={deleteAction} className="mt-3" onSubmit={(event) => { const warning = schoolClass.arms.length ? ` ${schoolClass.arms.length} arm(s) will be deleted too.` : ""; if (!window.confirm(`Permanently delete class ${schoolClass.name}?${warning}`)) event.preventDefault(); }}><input type="hidden" name="id" value={schoolClass.id}/><button disabled={deleting} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60">{deleting ? "Deleting…" : "Delete class"}</button><Message state={deleteState}/></form>
      </div></details>
    </div>
    <div className="mt-5 space-y-2">{schoolClass.arms.length ? schoolClass.arms.map((arm) => <ArmRow key={arm.id} arm={arm}/>) : <p className="text-sm text-slate-500">No arms defined.</p>}</div>
    <form action={armAction} className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[1fr_110px_auto]"><input type="hidden" name="classId" value={schoolClass.id}/><label className="text-xs font-medium text-slate-600">New arm<input name="name" placeholder="A" required maxLength={32} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label><label className="text-xs font-medium text-slate-600">Sort order<input name="sortOrder" type="number" min="0" max="9999" defaultValue="0" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label><button disabled={addingArm} className="self-end rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{addingArm ? "Adding…" : "Add arm"}</button><div className="sm:col-span-3"><Message state={armState}/></div></form>
  </article>;
}

export default function ClassManager({ classes }: { classes: SchoolClass[] }) {
  const [state, action, pending] = useActionState(saveClassAction, {});
  return <div className="space-y-6"><section className="card p-5 sm:p-6"><h2 className="text-base font-bold text-slate-900">Add a class</h2><p className="mt-1 text-sm text-slate-500">Create the class levels used at this school, such as JSS1 or SS2.</p><form action={action} className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_auto]"><label className="text-sm font-medium text-slate-700">Class name<input name="name" placeholder="JSS1" required maxLength={60} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"/></label><label className="text-sm font-medium text-slate-700">Sort order<input name="sortOrder" type="number" min="0" max="9999" defaultValue="0" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"/></label><button disabled={pending} className="self-end rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Creating…" : "Create class"}</button><div className="sm:col-span-3"><Message state={state}/></div></form></section><section className="grid gap-4 xl:grid-cols-2">{classes.length ? classes.map((schoolClass) => <ClassCard key={schoolClass.id} schoolClass={schoolClass}/>) : <p className="card p-6 text-sm text-slate-500">No classes have been created for this school.</p>}</section></div>;
}
