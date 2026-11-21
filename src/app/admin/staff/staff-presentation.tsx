import type { StaffRecord } from "./staff-types";

export function getStaffName(staff: Pick<StaffRecord, "first_name" | "middle_name" | "surname">): string {
  return [staff.first_name, staff.middle_name, staff.surname].filter(Boolean).join(" ");
}

export function formatStaffValue(value: string | null | undefined): string {
  if (!value) return "Not provided";
  return value.replaceAll("_", " ").replace(/^./, (first) => first.toUpperCase());
}

export function StaffAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-700">
      {initials || "S"}
    </span>
  );
}

export function StaffStatusBadge({ value, label }: { value: string; label?: string }) {
  const tone = ["active", "accepted"].includes(value)
    ? "bg-emerald-50 text-emerald-700 ring-emerald-600/15"
    : ["pending", "invited", "on_leave"].includes(value)
      ? "bg-amber-50 text-amber-800 ring-amber-600/15"
      : ["expired", "revoked", "deactivated", "terminated", "suspended"].includes(value)
        ? "bg-rose-50 text-rose-700 ring-rose-600/15"
        : "bg-slate-100 text-slate-700 ring-slate-500/10";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${tone}`}>
      {label ?? formatStaffValue(value)}
    </span>
  );
}
