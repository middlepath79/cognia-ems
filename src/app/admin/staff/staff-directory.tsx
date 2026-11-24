"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownUp, ChevronLeft, ChevronRight, Mail, Plus, Search, Users, X } from "lucide-react";
import StaffEditor from "./staff-editor";
import StaffProfile from "./staff-profile";
import { setStaffAccountStatusAction, type StaffState } from "./actions";
import { formatStaffValue, getStaffName, StaffAvatar, StaffStatusBadge } from "./staff-presentation";
import type {
  StaffDepartment,
  StaffDirectoryFilters,
  StaffDirectoryStats,
  StaffInvitation,
  StaffManager,
  StaffMembership,
  StaffRecord,
} from "./staff-types";

const pageSize = 12;
const input = "rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
const fieldLabel = "mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500";
const initialAccountState: StaffState = {};

function SummaryCard({ label, value, note, icon: Icon }: { label: string; value: number | null; note: string; icon: typeof Users }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(16,24,40,.025)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value === null ? "—" : value.toLocaleString()}</p>
        </div>
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-50 text-indigo-600"><Icon size={17} strokeWidth={1.8} /></span>
      </div>
      <p className="mt-3 text-[11px] text-slate-500">{note}</p>
    </article>
  );
}

function PageControls({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:px-5">
      <p className="text-xs text-slate-500">Page {page} of {pages}</p>
      <div className="flex gap-2">
        <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
          <ChevronLeft size={14} /> Previous
        </button>
        <button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
          Next <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function StaffAccountStatusControl({ id, status }: { id: string; status: string }) {
  const [state, action, pending] = useActionState(setStaffAccountStatusAction, initialAccountState);
  const nextStatus = status === "deactivated" ? "active" : "deactivated";
  return (
    <form
      action={action}
      className="mt-1"
      onSubmit={(event) => {
        const prompt = nextStatus === "deactivated"
          ? "Deactivate this staff account? The existing account will lose active access to this school."
          : "Reactivate this staff account for this school?";
        if (!window.confirm(prompt)) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={nextStatus} />
      <button type="submit" disabled={pending} className="text-xs font-semibold text-indigo-700 transition hover:text-indigo-900 disabled:opacity-50">
        {pending ? "Updating…" : nextStatus === "active" ? "Reactivate account" : "Deactivate account"}
      </button>
      {state.error && <p role="alert" className="mt-1 max-w-48 text-xs text-rose-700">{state.error}</p>}
      {state.success && <p role="status" className="mt-1 max-w-48 text-xs text-emerald-700">{state.success}</p>}
    </form>
  );
}

export default function StaffDirectoryClient({
  staff,
  departments,
  memberships,
  managers,
  invitations,
  stats,
  filters,
}: {
  staff: StaffRecord[];
  departments: StaffDepartment[];
  memberships: StaffMembership[];
  managers: StaffManager[];
  invitations: StaffInvitation[];
  stats: StaffDirectoryStats;
  filters: StaffDirectoryFilters;
}) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [profileStaffId, setProfileStaffId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ staffId: string | null } | null>(null);
  const [notice, setNotice] = useState("");

  const filterKey = [filters.q, filters.status, filters.department, filters.category, filters.account, filters.sort, filters.direction].join("|");
  useEffect(() => setPage(1), [filterKey]);
  const profileStaff = useMemo(
    () => staff.find((record) => record.id === profileStaffId) ?? null,
    [profileStaffId, staff],
  );
  const editorStaff = useMemo(
    () => (editor?.staffId ? staff.find((record) => record.id === editor.staffId) ?? null : null),
    [editor, staff],
  );
  useEffect(() => {
    if (profileStaffId && !staff.some((record) => record.id === profileStaffId)) {
      setProfileStaffId(null);
    }
    if (editor?.staffId && !staff.some((record) => record.id === editor.staffId)) {
      setEditor(null);
      setNotice("That staff profile is no longer available in this directory. Refresh and try again.");
    }
  }, [editor?.staffId, profileStaffId, staff]);

  const departmentsById = useMemo(() => new Map(departments.map((department) => [department.id, department.name])), [departments]);
  const managersById = useMemo(() => new Map(managers.map((manager) => [manager.id, getStaffName({ ...manager, middle_name: null })])), [managers]);
  const membershipByUserId = useMemo(() => new Map(memberships.map((membership) => [membership.user_id, membership])), [memberships]);
  const invitationByEmail = useMemo(() => {
    const map = new Map<string, StaffInvitation>();
    for (const invitation of invitations) {
      const key = `${invitation.email.toLowerCase()}:${invitation.role}`;
      if (!map.has(key)) map.set(key, invitation);
    }
    return map;
  }, [invitations]);

  const sortedStaff = useMemo(() => {
    const direction = filters.direction === "desc" ? -1 : 1;
    return [...staff].sort((a, b) => {
      let first: string | null = "";
      let second: string | null = "";
      switch (filters.sort) {
        case "employee_number":
          first = a.employee_number;
          second = b.employee_number;
          break;
        case "employment_status":
          first = a.employment_status;
          second = b.employment_status;
          break;
        case "joined_on":
          first = a.joined_on;
          second = b.joined_on;
          break;
        default:
          first = getStaffName(a);
          second = getStaffName(b);
      }
      return direction * (first ?? "").localeCompare(second ?? "", undefined, { numeric: true, sensitivity: "base" });
    });
  }, [filters.direction, filters.sort, staff]);

  const totalPages = Math.max(1, Math.ceil(sortedStaff.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStaff = sortedStaff.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const hasFilters = Boolean(filters.q || filters.status || filters.department || filters.category || filters.account);

  const handleSaved = useCallback((message: string) => {
    setEditor(null);
    setNotice(message);
    router.refresh();
  }, [router]);

  function invitationFor(record: StaffRecord): StaffInvitation | null {
    const role = record.staff_category === "teaching" ? "teacher" : "staff";
    return record.email ? invitationByEmail.get(`${record.email.toLowerCase()}:${role}`) ?? null : null;
  }

  function openEditor(record: StaffRecord | null) {
    setProfileStaffId(null);
    setEditor({ staffId: record?.id ?? null });
  }

  return (
    <>
      <section aria-label="Staff overview" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <SummaryCard label="Total staff" value={stats.total} note="Across this institution" icon={Users} />
        <SummaryCard label="Teaching staff" value={stats.teaching} note="Teaching category" icon={Users} />
        <SummaryCard label="Non-teaching" value={stats.nonTeaching} note="Non-teaching category" icon={Users} />
        <SummaryCard label="Active staff" value={stats.active} note="Currently active employment" icon={Users} />
        <SummaryCard label="Pending invitations" value={stats.pendingInvitations} note="Valid staff invitations" icon={Mail} />
      </section>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm leading-6 text-slate-600">Keep employee details, employment status and school account access together in one directory.</p>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Link href="/admin/invitations?role=staff" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
            <Mail size={16} /> Invite staff
          </Link>
          <button type="button" onClick={() => openEditor(null)} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 sm:flex-none">
            <Plus size={16} /> Add staff
          </button>
        </div>
      </div>

      {notice && (
        <div role="status" className="mb-4 flex items-start justify-between gap-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <p>{notice}</p>
          <button type="button" onClick={() => setNotice("")} aria-label="Dismiss success message" className="rounded p-0.5 text-emerald-800 hover:bg-emerald-100"><X size={16} /></button>
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(16,24,40,.025)]">
        <form method="get" className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 xl:grid-cols-6 sm:p-5">
          <label className="sm:col-span-2 xl:col-span-2">
            <span className={fieldLabel}>Search directory</span>
            <span className="relative block">
              <Search size={16} aria-hidden="true" className="absolute left-3 top-3 text-slate-400" />
              <input name="q" defaultValue={filters.q} className={`${input} w-full pl-9`} placeholder="Name, employee ID or email" />
            </span>
          </label>
          <label>
            <span className={fieldLabel}>Category</span>
            <select name="category" defaultValue={filters.category ?? ""} className={`${input} w-full`}>
              <option value="">All categories</option><option value="teaching">Teaching</option><option value="non_teaching">Non-teaching</option>
            </select>
          </label>
          <label>
            <span className={fieldLabel}>Department</span>
            <select name="department" defaultValue={filters.department ?? ""} className={`${input} w-full`}>
              <option value="">All departments</option>
              {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
          </label>
          <label>
            <span className={fieldLabel}>Employment status</span>
            <select name="status" defaultValue={filters.status ?? ""} className={`${input} w-full`}>
              <option value="">All statuses</option>
              {["active", "on_leave", "suspended", "terminated", "retired"].map((status) => <option key={status} value={status}>{formatStaffValue(status)}</option>)}
            </select>
          </label>
          <label>
            <span className={fieldLabel}>Account status</span>
            <select name="account" defaultValue={filters.account ?? ""} className={`${input} w-full`}>
              <option value="">All account statuses</option>
              {["pending", "invited", "active", "deactivated"].map((status) => <option key={status} value={status}>{formatStaffValue(status)}</option>)}
            </select>
          </label>
          <label>
            <span className={fieldLabel}>Sort by</span>
            <select name="sort" defaultValue={filters.sort ?? "name"} className={`${input} w-full`}>
              <option value="name">Name</option><option value="employee_number">Employee ID</option><option value="employment_status">Employment status</option><option value="joined_on">Start date</option>
            </select>
          </label>
          <label>
            <span className={fieldLabel}>Order</span>
            <select name="direction" defaultValue={filters.direction ?? "asc"} className={`${input} w-full`}>
              <option value="asc">Ascending</option><option value="desc">Descending</option>
            </select>
          </label>
          <div className="flex items-end gap-2 sm:col-span-2 xl:col-span-6">
            <button type="submit" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800">
              <Search size={15} /> Apply filters
            </button>
            {hasFilters && <Link href="/admin/staff" className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Clear filters</Link>}
            <span className="ml-auto hidden items-center gap-1.5 text-xs text-slate-500 sm:inline-flex"><ArrowDownUp size={14} /> {staff.length.toLocaleString()} matching records</span>
          </div>
        </form>

        {staff.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[970px] text-left text-sm">
                <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-5 py-3.5 font-semibold">Staff member</th>
                    <th scope="col" className="px-5 py-3.5 font-semibold">Employee ID</th>
                    <th scope="col" className="px-5 py-3.5 font-semibold">Department</th>
                    <th scope="col" className="px-5 py-3.5 font-semibold">Category & type</th>
                    <th scope="col" className="px-5 py-3.5 font-semibold">Employment</th>
                    <th scope="col" className="px-5 py-3.5 font-semibold">Account access</th>
                    <th scope="col" className="px-5 py-3.5 text-right font-semibold"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pageStaff.map((record) => {
                    const name = getStaffName(record);
                    const invitation = invitationFor(record);
                    return (
                      <tr key={record.id} className="transition-colors hover:bg-slate-50/70">
                        <td className="px-5 py-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <StaffAvatar name={name} />
                            <div className="min-w-0">
                              <button type="button" onClick={() => setProfileStaffId(record.id)} className="block max-w-[220px] truncate text-left font-semibold text-slate-900 hover:text-indigo-700">{name}</button>
                              <p className="mt-0.5 max-w-[220px] truncate text-xs text-slate-500">{record.email || "No email provided"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 font-mono text-xs font-medium text-slate-700">{record.employee_number}</td>
                        <td className="px-5 py-4">
                          <p className="text-sm text-slate-700">{departmentsById.get(record.department_id ?? "") ?? "—"}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{record.designation || "No designation"}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm text-slate-700">{formatStaffValue(record.staff_category)}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{formatStaffValue(record.employment_type)}</p>
                        </td>
                        <td className="px-5 py-4"><StaffStatusBadge value={record.employment_status} /></td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col items-start gap-1.5">
                            <StaffStatusBadge value={record.account_status} />
                            {invitation && <StaffStatusBadge value={invitation.status} label={`Invitation ${formatStaffValue(invitation.status).toLowerCase()}`} />}
                            {record.user_id && ["staff", "teacher"].includes(membershipByUserId.get(record.user_id)?.role ?? "") && (
                              <StaffAccountStatusControl id={record.id} status={record.account_status} />
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setProfileStaffId(record.id)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white hover:text-indigo-700">View</button>
                            <button type="button" onClick={() => openEditor(record)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white hover:text-indigo-700">Edit</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
              {pageStaff.map((record) => {
                const name = getStaffName(record);
                const invitation = invitationFor(record);
                return (
                  <article key={record.id} className="p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <StaffAvatar name={name} />
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-sm font-bold text-slate-900">{name}</h2>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{record.email || "No email provided"}</p>
                        <p className="mt-1 font-mono text-[11px] text-slate-500">{record.employee_number}</p>
                      </div>
                      <StaffStatusBadge value={record.employment_status} />
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-slate-50 p-3">
                      <div><dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Designation</dt><dd className="mt-1 truncate text-xs font-medium text-slate-800">{record.designation || "—"}</dd></div>
                      <div><dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Department</dt><dd className="mt-1 truncate text-xs font-medium text-slate-800">{departmentsById.get(record.department_id ?? "") ?? "—"}</dd></div>
                      <div><dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Category</dt><dd className="mt-1 text-xs font-medium text-slate-800">{formatStaffValue(record.staff_category)}</dd></div>
                      <div><dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Employment type</dt><dd className="mt-1 text-xs font-medium text-slate-800">{formatStaffValue(record.employment_type)}</dd></div>
                    </dl>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <StaffStatusBadge value={record.account_status} />
                      {invitation && <StaffStatusBadge value={invitation.status} label={`Invitation ${formatStaffValue(invitation.status).toLowerCase()}`} />}
                    </div>
                    {record.user_id && ["staff", "teacher"].includes(membershipByUserId.get(record.user_id)?.role ?? "") && (
                      <StaffAccountStatusControl id={record.id} status={record.account_status} />
                    )}
                    <div className="mt-4 flex gap-2">
                      <button type="button" onClick={() => setProfileStaffId(record.id)} className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">View profile</button>
                      <button type="button" onClick={() => openEditor(record)} className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">Edit</button>
                    </div>
                  </article>
                );
              })}
            </div>

            {totalPages > 1 && <PageControls page={currentPage} pages={totalPages} onChange={setPage} />}
          </>
        ) : (
          <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-500"><Users size={21} /></span>
            <h2 className="mt-4 text-base font-semibold text-slate-900">{hasFilters ? "No matching staff" : "No staff records yet"}</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
              {hasFilters ? "Try a different search or clear some filters to see more staff records." : "Add a staff profile to begin building your institution’s directory."}
            </p>
            {hasFilters
              ? <Link href="/admin/staff" className="mt-4 text-sm font-semibold text-indigo-700 hover:text-indigo-800">Clear all filters</Link>
              : <button type="button" onClick={() => openEditor(null)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"><Plus size={15} /> Add staff member</button>}
          </div>
        )}
      </section>

      {profileStaff && (
        <StaffProfile
          staff={profileStaff}
          department={departmentsById.get(profileStaff.department_id ?? "") ?? null}
          managerName={managersById.get(profileStaff.reporting_manager_id ?? "") ?? null}
          membership={profileStaff.user_id ? membershipByUserId.get(profileStaff.user_id) ?? null : null}
          invitation={invitationFor(profileStaff)}
          onEdit={() => openEditor(profileStaff)}
          onClose={() => setProfileStaffId(null)}
        />
      )}
      {editor && (!editor.staffId || editorStaff) && (
        <StaffEditor
          staff={editorStaff}
          departments={departments}
          managers={managers}
          memberships={memberships}
          invitation={editorStaff ? invitationFor(editorStaff) : null}
          onSaved={handleSaved}
          onClose={() => setEditor(null)}
        />
      )}
    </>
  );
}
