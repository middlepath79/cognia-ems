"use client";

import { useActionState } from "react";
import { revokeInvitationAction, type InvitationRevocationState } from "./actions";

const initialState: InvitationRevocationState = {};

export default function RevokeInvitationButton({ invitationId }: { invitationId: string }) {
  const [state, action, pending] = useActionState(revokeInvitationAction, initialState);

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("Revoke this invitation? Its link will no longer grant school access.")) event.preventDefault();
      }}
    >
      <input type="hidden" name="invitationId" value={invitationId} />
      <button disabled={pending} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50">
        {pending ? "Revoking…" : "Revoke"}
      </button>
      {state.error && <p role="alert" className="mt-1 text-xs text-rose-700">{state.error}</p>}
      {state.success && <p role="status" className="mt-1 text-xs text-emerald-700">{state.success}</p>}
    </form>
  );
}
