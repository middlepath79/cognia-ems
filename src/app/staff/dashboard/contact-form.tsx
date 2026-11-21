"use client";

import { useActionState } from "react";
import { updateMyStaffContact, type StaffContactState } from "./actions";

const initialState: StaffContactState = {};
const input = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

export default function StaffContactForm({ phone, address, schoolId }: { phone: string; address: string; schoolId: string }) {
  const [state, action, pending] = useActionState(updateMyStaffContact, initialState);

  return (
    <form action={action} className="mt-4 grid gap-3">
      <input type="hidden" name="schoolId" value={schoolId} />
      <label className="text-xs font-medium text-slate-600">
        Phone
        <input name="phone" type="tel" maxLength={40} defaultValue={phone} className={input} />
      </label>
      <label className="text-xs font-medium text-slate-600">
        Residential address
        <textarea name="address" maxLength={500} defaultValue={address} className={input} />
      </label>
      <p className="text-xs text-slate-500">Only phone and residential address can be edited here. Employment and account details are institution-managed.</p>
      <button type="submit" disabled={pending} className="btn btn-primary w-fit">
        {pending ? "Saving…" : "Save contact details"}
      </button>
      {state.error && <p role="alert" className="text-sm text-rose-700">{state.error}</p>}
      {state.success && <p role="status" className="text-sm text-emerald-700">{state.success}</p>}
    </form>
  );
}
