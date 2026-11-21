"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveStaffRecord, type StaffState } from "./actions";
import { formatStaffValue, StaffStatusBadge } from "./staff-presentation";
import type { StaffDepartment, StaffInvitation, StaffManager, StaffMembership, StaffRecord } from "./staff-types";

const initialState: StaffState = {};
const input = "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
const label = "block text-xs font-semibold text-slate-600";
const statuses = ["active", "on_leave", "suspended", "terminated", "retired"];
const employmentTypes = ["full_time", "part_time", "contract", "temporary", "adjunct"];

export default function StaffEditor({
  staff,
  departments,
  managers,
  memberships,
  invitation,
  onSaved,
  onClose,
}: {
  staff: StaffRecord | null;
  departments: StaffDepartment[];
  managers: StaffManager[];
  memberships: StaffMembership[];
  invitation: StaffInvitation | null;
  onSaved: (message: string) => void;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(saveStaffRecord, initialState);
  const [invitationLink, setInvitationLink] = useState("");
  const [copyError, setCopyError] = useState("");
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const handledState = useRef<StaffState | null>(null);
  const linkedMembership = memberships.find((membership) => membership.user_id === staff?.user_id);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  useEffect(() => {
    setInvitationLink(state.invitationToken
      ? `${window.location.origin}/accept-invitation?token=${state.invitationToken}`
      : "");
    setCopied(false);
    setCopyError("");
  }, [state.invitationToken]);

  useEffect(() => {
    if (state.success && !state.invitationToken && state !== handledState.current) {
      handledState.current = state;
      onSaved(state.success);
    }
  }, [state, onSaved]);

  async function copyInvitationLink() {
    try {
      await navigator.clipboard.writeText(invitationLink);
      setCopied(true);
      setCopyError("");
    } catch {
      setCopied(false);
      setCopyError("Copying was unavailable. Select and copy the invitation link above.");
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="staff-editor-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
      className="fixed inset-0 m-0 h-dvh max-h-dvh w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-slate-950/40"
    >
      <div className="grid min-h-full place-items-center p-0 sm:p-5">
        <section className="flex h-dvh w-full max-w-3xl flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-2xl sm:border sm:border-slate-200">
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-7">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[.12em] text-indigo-600">Staff record</p>
              <h2 id="staff-editor-title" className="mt-1 text-lg font-bold tracking-tight text-slate-900">
                {staff ? "Edit staff profile" : "Add staff member"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {staff ? "Update personal and employment details." : "Create an employee profile and securely prepare account access."}
              </p>
            </div>
            <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Close staff form" className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800">
              <span aria-hidden="true" className="text-xl leading-none">×</span>
            </button>
          </header>

          <form
            key={staff?.id ?? state.invitationToken ?? "new-staff"}
            action={action}
            className="min-h-0 flex-1 overflow-y-auto"
          >
            <div className="grid gap-6 p-5 sm:p-7">
              <section aria-labelledby="personal-information-heading">
                <div className="mb-4 border-b border-slate-100 pb-3">
                  <h3 id="personal-information-heading" className="text-sm font-bold text-slate-900">Personal information</h3>
                  <p className="mt-1 text-xs text-slate-500">Contact details used for the employee record and invitation.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={label}>First name<input name="firstName" required maxLength={100} defaultValue={staff?.first_name ?? ""} className={input} autoComplete="given-name" /></label>
                  <label className={label}>Last name<input name="surname" required maxLength={100} defaultValue={staff?.surname ?? ""} className={input} autoComplete="family-name" /></label>
                  <label className={label}>Other names<input name="middleName" maxLength={100} defaultValue={staff?.middle_name ?? ""} className={input} autoComplete="additional-name" /></label>
                  <label className={label}>Work email<input name="email" type="email" required maxLength={254} defaultValue={staff?.email ?? ""} className={input} autoComplete="email" /></label>
                  <label className={label}>Phone number<input name="phone" type="tel" maxLength={40} defaultValue={staff?.phone ?? ""} className={input} autoComplete="tel" /></label>
                  <label className={label}>Profile photograph URL<input name="profilePhotoUrl" type="url" maxLength={2048} defaultValue={staff?.profile_photo_url ?? ""} className={input} placeholder="https://" /></label>
                  <label className={label}>
                    Gender (optional)
                    <select name="gender" defaultValue={staff?.gender ?? ""} className={input}>
                      <option value="">Not provided</option>
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                      <option value="non_binary">Non-binary</option>
                      <option value="prefer_not_to_say">Prefer not to say</option>
                    </select>
                  </label>
                  <label className={label}>Date of birth (optional)<input name="dateOfBirth" type="date" defaultValue={staff?.date_of_birth ?? ""} className={input} /></label>
                  <label className={`${label} sm:col-span-2`}>Address<textarea name="address" maxLength={500} defaultValue={staff?.address ?? ""} rows={2} className={input} autoComplete="street-address" /></label>
                </div>
              </section>

              <section aria-labelledby="employment-information-heading">
                <div className="mb-4 border-b border-slate-100 pb-3">
                  <h3 id="employment-information-heading" className="text-sm font-bold text-slate-900">Employment information</h3>
                  <p className="mt-1 text-xs text-slate-500">Maintain the institution-controlled role and employment record.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={label}>Employee ID<input name="employeeNumber" required maxLength={32} defaultValue={staff?.employee_number ?? ""} className={input} /></label>
                  <label className={label}>
                    Staff category
                    <select name="staffCategory" required defaultValue={staff?.staff_category ?? "non_teaching"} className={input}>
                      <option value="teaching">Teaching</option>
                      <option value="non_teaching">Non-teaching</option>
                    </select>
                  </label>
                  <label className={label}>
                    Department
                    <select name="departmentId" defaultValue={staff?.department_id ?? ""} className={input}>
                      <option value="">No department</option>
                      {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                    </select>
                  </label>
                  <label className={label}>Designation<input name="designation" maxLength={120} defaultValue={staff?.designation ?? ""} className={input} placeholder="e.g. Mathematics Teacher" /></label>
                  <label className={label}>
                    Employment status
                    <select name="employmentStatus" defaultValue={staff?.employment_status ?? "active"} className={input}>
                      {statuses.map((status) => <option key={status} value={status}>{formatStaffValue(status)}</option>)}
                    </select>
                  </label>
                  <label className={label}>
                    Employment type
                    <select name="employmentType" defaultValue={staff?.employment_type ?? "full_time"} className={input}>
                      {employmentTypes.map((type) => <option key={type} value={type}>{formatStaffValue(type)}</option>)}
                    </select>
                  </label>
                  <label className={label}>Start date<input name="joinedOn" type="date" defaultValue={staff?.joined_on ?? ""} className={input} /></label>
                  <label className={label}>
                    Reporting manager
                    <select name="reportingManagerId" defaultValue={staff?.reporting_manager_id ?? ""} className={input}>
                      <option value="">No reporting manager</option>
                      {managers.filter((manager) => manager.id !== staff?.id).map((manager) => (
                        <option key={manager.id} value={manager.id}>{manager.first_name} {manager.surname} · {manager.employee_number}</option>
                      ))}
                    </select>
                  </label>
                  <label className={`${label} sm:col-span-2`}>Notes (optional)<textarea name="notes" maxLength={2000} defaultValue={staff?.notes ?? ""} rows={2} className={input} /></label>
                </div>
              </section>

              <section aria-labelledby="account-access-heading">
                <div className="mb-4 border-b border-slate-100 pb-3">
                  <h3 id="account-access-heading" className="text-sm font-bold text-slate-900">Account and access</h3>
                  <p className="mt-1 text-xs text-slate-500">Access is linked through a school membership and the secure invitation flow.</p>
                </div>
                <label className={label}>
                  Link an existing school account (optional)
                  <select name="userId" defaultValue={staff?.user_id ?? ""} className={input}>
                    <option value="">
                      {staff
                        ? staff.user_id ? `Keep linked account${linkedMembership ? ` · ${linkedMembership.role}` : ""}` : "Keep account unlinked"
                        : "Create a new account invitation"}
                    </option>
                    {memberships.filter((membership) => membership.user_id !== staff?.user_id).map((membership) => (
                      <option key={membership.user_id} value={membership.user_id}>
                        {membership.display_name || membership.user_id} · {membership.role}{membership.status === "suspended" ? " (suspended)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                {staff ? (
                  <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                    <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Account status</p><div className="mt-2"><StaffStatusBadge value={staff.account_status} /></div></div>
                    <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Latest invitation</p><div className="mt-2">{invitation ? <StaffStatusBadge value={invitation.status} /> : <span className="text-sm text-slate-500">No invitation on record</span>}</div></div>
                    <p className="text-xs leading-5 text-slate-500 sm:col-span-2">
                      {linkedMembership
                        ? `Linked school membership: ${linkedMembership.role} (${linkedMembership.status}).`
                        : "No school membership is currently linked to this profile."} Permissions are determined by the staff category and existing school membership.
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                    A secure invitation link is generated after saving a new, unlinked staff profile. Invitation access is verified by the server.
                  </p>
                )}
              </section>

              {state.error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{state.error}</p>}
              {state.success && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">{state.success}</p>}
              {invitationLink && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-semibold text-emerald-900">Invitation ready to share</p>
                  <p className="mt-1 break-all text-xs text-emerald-800">{invitationLink}</p>
                  <button type="button" onClick={copyInvitationLink} className="mt-3 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100">
                    {copied ? "Copied" : "Copy invitation link"}
                  </button>
                  {copyError && <p role="alert" className="mt-2 text-xs text-rose-700">{copyError}</p>}
                  <p className="mt-2 text-xs text-emerald-800">This one-time link is shown only now. It cannot be recovered later.</p>
                </div>
              )}
            </div>
            <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white px-5 py-4 sm:px-7">
              <p className="text-xs text-slate-500">Changes are protected by your school administrator access.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => dialogRef.current?.close()} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Close</button>
                <button disabled={pending || Boolean(state.success)} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {pending ? "Saving…" : staff ? "Save changes" : "Save staff profile"}
                </button>
              </div>
            </footer>
          </form>
        </section>
      </div>
    </dialog>
  );
}
