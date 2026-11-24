"use client";

import { useEffect, useRef } from "react";
import { formatStaffValue, getStaffName, StaffAvatar, StaffStatusBadge } from "./staff-presentation";
import type { StaffInvitation, StaffMembership, StaffRecord } from "./staff-types";

function displayDate(value: string | null): string {
  if (!value) return "Not provided";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function ProfileField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-slate-800">{value || "Not provided"}</dd>
    </div>
  );
}

export default function StaffProfile({
  staff,
  department,
  managerName,
  membership,
  invitation,
  onEdit,
  onClose,
}: {
  staff: StaffRecord;
  department: string | null;
  managerName: string | null;
  membership: StaffMembership | null;
  invitation: StaffInvitation | null;
  onEdit: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const name = getStaffName(staff);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="staff-profile-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
      className="fixed inset-0 m-0 h-dvh max-h-dvh w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-slate-950/40"
    >
      <div className="grid min-h-full place-items-center p-0 sm:p-5">
        <section className="flex h-dvh w-full max-w-3xl flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-2xl sm:border sm:border-slate-200">
          <header className="flex shrink-0 items-start gap-4 border-b border-slate-100 px-5 py-5 sm:px-7">
            <StaffAvatar name={name} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[.12em] text-indigo-600">Staff profile</p>
              <h2 id="staff-profile-title" className="mt-1 truncate text-lg font-bold tracking-tight text-slate-900">{name}</h2>
              <p className="mt-1 text-sm text-slate-500">{staff.designation || "No designation"}{department ? ` · ${department}` : ""}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StaffStatusBadge value={staff.employment_status} />
                <StaffStatusBadge value={staff.staff_category} label={formatStaffValue(staff.staff_category)} />
              </div>
            </div>
            <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Close staff profile" className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800">
              <span aria-hidden="true" className="text-xl leading-none">×</span>
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
            <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Employee ID</p>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-900">{staff.employee_number}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <section className="rounded-xl border border-slate-200 p-4 sm:p-5">
                <h3 className="mb-4 text-sm font-bold text-slate-900">Personal information</h3>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <ProfileField label="Email" value={staff.email} />
                  <ProfileField label="Phone" value={staff.phone} />
                  <ProfileField label="Other names" value={staff.middle_name} />
                  <ProfileField label="Gender" value={staff.gender ? formatStaffValue(staff.gender) : null} />
                  <ProfileField label="Date of birth" value={displayDate(staff.date_of_birth)} />
                  <ProfileField label="Address" value={staff.address} />
                </dl>
              </section>

              <section className="rounded-xl border border-slate-200 p-4 sm:p-5">
                <h3 className="mb-4 text-sm font-bold text-slate-900">Employment information</h3>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <ProfileField label="Category" value={formatStaffValue(staff.staff_category)} />
                  <ProfileField label="Department" value={department} />
                  <ProfileField label="Designation" value={staff.designation} />
                  <ProfileField label="Employment type" value={formatStaffValue(staff.employment_type)} />
                  <ProfileField label="Employment status" value={formatStaffValue(staff.employment_status)} />
                  <ProfileField label="Start date" value={displayDate(staff.joined_on)} />
                  <ProfileField label="Reporting manager" value={managerName} />
                  <ProfileField label="Notes" value={staff.notes} />
                </dl>
              </section>

              <section className="rounded-xl border border-slate-200 p-4 sm:p-5 md:col-span-2">
                <h3 className="mb-4 text-sm font-bold text-slate-900">Account and invitation</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Account status</p><div className="mt-2"><StaffStatusBadge value={staff.account_status} /></div></div>
                  <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Latest invitation</p><div className="mt-2">{invitation ? <StaffStatusBadge value={invitation.status} /> : <span className="text-sm text-slate-500">No invitation on record</span>}</div></div>
                  <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Linked school account</p><p className="mt-2 text-sm text-slate-800">{membership ? `${membership.role} · ${membership.status}` : "Not linked"}</p></div>
                </div>
                <p className="mt-4 text-xs leading-5 text-slate-500">School access is controlled by the linked membership and verified invitation workflow.</p>
              </section>
            </div>
          </div>

          <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-5 py-4 sm:px-7">
            <button type="button" onClick={() => dialogRef.current?.close()} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Close</button>
            <button type="button" onClick={() => { dialogRef.current?.close(); onEdit(); }} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700">Edit staff profile</button>
          </footer>
        </section>
      </div>
    </dialog>
  );
}
