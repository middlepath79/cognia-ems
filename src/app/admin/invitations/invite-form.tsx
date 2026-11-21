"use client";

import { useActionState, useEffect, useState } from "react";
import { createInvitationAction, type InvitationActionState } from "./actions";

const initialState: InvitationActionState = {};

export default function InviteForm({ schools, defaultRole }: { schools: { id: string; name: string }[]; defaultRole?: "teacher" | "staff" }) {
  const [state, action, pending] = useActionState(createInvitationAction, initialState);
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");

  useEffect(() => {
    setInviteLink(state.token ? `${window.location.origin}/accept-invitation?token=${state.token}` : "");
    setCopied(false);
  }, [state.token]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setCopyError("");
    } catch {
      setCopied(false);
      setCopyError("Copying was unavailable. Select and copy the invitation link above.");
    }
  }

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-sm font-bold text-slate-800">Create an invitation</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        The invitation expires after seven days. Share the generated link using your approved communication channel.
        {defaultRole && " A matching pending staff profile is required; create a new employee profile in Staff Management first."}
      </p>
      <form action={action} className="mt-5 grid gap-4 md:grid-cols-3">
        <label className="text-sm font-medium text-slate-700">School<select name="schoolId" required className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal">{schools.map((school) => <option value={school.id} key={school.id}>{school.name}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700">Email<input name="email" type="email" required className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" /></label>
        <label className="text-sm font-medium text-slate-700">Role<select name="role" required defaultValue={defaultRole ?? "school_admin"} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal">{["school_admin", "teacher", "staff", "student", "parent"].map((role) => <option value={role} key={role}>{role === "staff" ? "non-teaching staff" : role.replaceAll("_", " ")}</option>)}</select></label>
        {state.error && <p role="alert" className="text-sm text-rose-700 md:col-span-3">{state.error}</p>}
        <div className="md:col-span-3"><button disabled={pending || !schools.length} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Creating…" : "Create invitation"}</button></div>
      </form>
      {inviteLink && <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4"><p className="text-sm font-semibold text-emerald-900">Invitation created</p><p className="mt-1 break-all text-xs text-emerald-800">{inviteLink}</p><button type="button" onClick={copyLink} className="mt-3 rounded-md border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-900">{copied ? "Copied" : "Copy invitation link"}</button>{copyError && <p role="alert" className="mt-2 text-xs text-rose-700">{copyError}</p>}<p className="mt-2 text-xs text-emerald-800">This link is shown only now. It is not stored in the database and cannot be recovered later.</p></div>}
    </section>
  );
}
