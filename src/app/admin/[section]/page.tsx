import { notFound } from "next/navigation";
import { ClipboardCheck, Wallet, Users, ChartNoAxesCombined, Settings } from "lucide-react";
import PageHeading from "@/components/page-heading";

const pages: Record<string, { title: string; description: string; icon: typeof Users; features: string[] }> = {
  staff: { title: "Staff", description: "Manage teaching and non-teaching staff records.", icon: Users, features: ["Staff profiles and contact information", "Departments and designations", "Staff attendance and leave records"] },
  attendance: { title: "Attendance", description: "Monitor daily attendance across all school levels.", icon: ClipboardCheck, features: ["Daily class attendance register", "Late arrivals and absence tracking", "Attendance summaries and exports"] },
  fees: { title: "Fees & Payments", description: "Track school fees, invoices and payment records.", icon: Wallet, features: ["Fee categories and term invoices", "Payment history and outstanding balances", "Receipts and finance summaries"] },
  reports: { title: "Reports", description: "View useful operational and academic summaries.", icon: ChartNoAxesCombined, features: ["Enrolment and attendance reports", "Academic performance summaries", "Fee collection reports"] },
  settings: { title: "Settings", description: "Configure the school profile and platform preferences.", icon: Settings, features: ["School identity and contact details", "Academic session and term settings", "User roles and access permissions"] },
};

export function generateStaticParams() { return Object.keys(pages).map((section) => ({ section })); }

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const page = pages[section];
  if (!page) notFound();
  const Icon = page.icon;
  return (
    <>
      <PageHeading title={page.title} description={page.description}/>
      <div className="card p-6 sm:p-8">
        <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-brand"><Icon size={23}/></div>
        <h2 className="text-lg font-bold text-slate-900">{page.title} workspace</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">This area is part of your school workspace. We’ll build its forms, tables and workflows one module at a time.</p>
        <div className="mt-7 grid gap-3 md:grid-cols-2">
          {page.features.map((feature)=> <div key={feature} className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700"><span className="mr-2 text-brand">✓</span>{feature}</div>)}
        </div>
        <div className="mt-7 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/60 p-4 text-xs leading-5 text-indigo-800">Build status: starter page ready. Real records, permissions and actions are not connected yet.</div>
      </div>
    </>
  );
}
