"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import CogniaBrand from "@/components/brand/cognia-brand";
import {
  LayoutDashboard, Users, GraduationCap, ClipboardCheck, BookOpen, CalendarDays, School, FilePlus2,
  Wallet, ChartNoAxesCombined, Settings, Menu, X, Bell, Search, Mail, ClipboardList,
  ChevronDown, LogOut
} from "lucide-react";

const navigation = [
  { label: "OVERVIEW", items: [{ title: "Dashboard", href: "/admin", icon: LayoutDashboard }] },
  { label: "INSTITUTION", items: [
    { title: "Students", href: "/admin/students", icon: GraduationCap },
    { title: "Admissions", href: "/admin/admissions", icon: FilePlus2 },
    { title: "Staff", href: "/admin/staff", icon: Users },
    { title: "Attendance", href: "/admin/attendance", icon: ClipboardCheck },
  ]},
  { label: "ACADEMICS", items: [
    { title: "Academic Calendar", href: "/admin/academics", icon: CalendarDays },
    { title: "Timetable", href: "/admin/timetable", icon: CalendarDays },
    { title: "Assessments", href: "/admin/assessments", icon: ClipboardList },
    { title: "Examinations & Results", href: "/admin/examinations", icon: ClipboardCheck },
    { title: "Academic Records", href: "/admin/academic-records", icon: ChartNoAxesCombined },
    { title: "Classes & Arms", href: "/admin/classes", icon: School },
    { title: "Academic Structure", href: "/admin/academic-structure", icon: BookOpen },
  ]},
  { label: "FINANCE & INSIGHTS", items: [
    { title: "Fees & Payments", href: "/admin/fees", icon: Wallet },
    { title: "Reports", href: "/admin/reports", icon: ChartNoAxesCombined },
  ]},
  { label: "SYSTEM", items: [{ title: "Settings", href: "/admin/settings", icon: Settings }] },
  { label: "ACCESS", items: [{ title: "Invitations", href: "/admin/invitations", icon: Mail }] },
];

type AdminShellProps = { children: React.ReactNode; showPlatformAdministration?: boolean; teacherView?: boolean; school: { id: string; name: string; institution_type: string; academic_period_label: string }; schools?: { id: string; name: string }[]; academicSessionName: string | null; activeTermName: string | null };

export default function AdminShell({ children, showPlatformAdministration = false, teacherView = false, school, schools = [], academicSessionName, activeTermName }: AdminShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="dashboard-shell">
      <div className={`overlay ${menuOpen ? "show" : ""}`} onClick={() => setMenuOpen(false)} />
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <CogniaBrand tone="dark" size="compact" subtitle={school.name} className="flex-1" />
          <button className="ml-auto lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={19}/></button>
        </div>

        <div className="mb-5 rounded-xl border border-white/10 bg-white/[.05] px-3 py-3">
          <p className="text-[10px] font-bold tracking-[1.4px] text-slate-400">CURRENT ACADEMIC SESSION</p>
          <p className="mt-1 text-sm font-semibold text-white">{academicSessionName ?? "No active session"}</p>
          <p className="mt-1 text-xs text-slate-400">{activeTermName ? `${activeTermName} · ${school.academic_period_label}` : `No active ${school.academic_period_label.toLowerCase()}`}</p>
        </div>

        <nav className="flex-1 overflow-y-auto">
          {schools.length > 1 && <div className="mb-3 px-2"><p className="nav-label">INSTITUTION WORKSPACE</p><form action="/admin/switch" method="get"><select name="schoolId" aria-label="Select institution workspace" className="mt-1 w-full rounded-md border border-white/10 bg-slate-800 px-2 py-2 text-xs text-white" value={school.id} onChange={(event) => event.currentTarget.form?.requestSubmit()}>{schools.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></form></div>}
          {showPlatformAdministration && (
            <div className="mb-3 rounded-xl border border-indigo-300/20 bg-indigo-400/10 p-3">
              <p className="mb-2 text-[10px] font-bold tracking-[1.2px] text-indigo-200">ADMINISTRATION</p>
              <Link href="/platform" onClick={() => setMenuOpen(false)} className="nav-link">
                <Settings size={17} strokeWidth={1.8}/><span>Platform Administration</span>
              </Link>
            </div>
          )}
          {(teacherView ? [{ label: "TEACHING", items: [{ title: "Attendance", href: "/admin/attendance", icon: ClipboardCheck }, { title: "Timetable", href: "/admin/timetable", icon: CalendarDays }, { title: "Assessments", href: "/admin/assessments", icon: ClipboardList }, { title: "Examinations & Results", href: "/admin/examinations", icon: ClipboardCheck }] }] : navigation).map((group) => (
            <div key={group.label} className="mb-2">
              <p className="nav-label">{group.label}</p>
              {group.items.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}
                    className={`nav-link ${active ? "active" : ""}`}>
                    <Icon size={17} strokeWidth={1.8}/><span>{item.title}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="admin-mini">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-indigo-400 text-xs font-bold text-white">AD</div>
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-white">{teacherView ? "Teacher / Lecturer" : "School Administrator"}</p><p className="mt-1 text-[10px] text-slate-400">{teacherView ? "Teaching workspace" : "Institution administrator"}</p></div>
            <form action="/auth/signout" method="post">
              <button type="submit" className="rounded p-1 text-slate-400 hover:text-white" aria-label="Sign out">
                <LogOut size={15}/>
              </button>
            </form>
          </div>

          <div className="mt-4 flex flex-col items-center gap-2 text-[10px] tracking-widest text-slate-500">
            <span>POWERED BY</span>
            <CogniaBrand tone="dark" size="compact" />
          </div>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="flex items-center gap-3">
            <button className="mobile-menu rounded-lg border border-slate-200 p-2 text-slate-700" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={19}/></button>
            <div className="hidden items-center gap-2 text-xs text-slate-400 sm:flex"><CogniaBrand size="compact" /><span>/</span><span className="font-semibold text-slate-700">{school.name}</span></div>
            <CogniaBrand size="compact" subtitle={school.name} className="sm:hidden" />
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 md:flex">
              <Search size={15} className="text-slate-400"/><span className="text-xs text-slate-400">Search anything...</span><kbd className="ml-5 rounded border bg-white px-1.5 py-0.5 text-[10px] text-slate-400">⌘ K</kbd>
            </div>
            <button className="relative rounded-lg border border-slate-200 p-2 text-slate-500" aria-label="Notifications"><Bell size={17}/><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose-500"/></button>
            <div className="hidden h-8 w-px bg-slate-200 sm:block"/>
            <button className="flex items-center gap-2">
              <div className="avatar">AD</div><span className="hide-mobile text-xs font-semibold text-slate-700">Admin</span><ChevronDown size={14} className="hide-mobile text-slate-400"/>
            </button>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
