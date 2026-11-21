import type { LucideIcon } from "lucide-react";

export default function AdminStat({ label, value, note, icon: Icon, tone = "blue" }: {
  label: string; value: string; note: string; icon: LucideIcon; tone?: "blue" | "green" | "amber" | "purple";
}) {
  const tones = {
    blue: "bg-indigo-50 text-indigo-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    purple: "bg-violet-50 text-violet-600",
  };
  return (
    <div className="card stat-card">
      <div className="flex items-start justify-between">
        <div><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{value}</p></div>
        <div className={`stat-icon ${tones[tone]}`}><Icon size={19}/></div>
      </div>
      <p className="mt-3 text-[11px] text-slate-400">{note}</p>
    </div>
  );
}
