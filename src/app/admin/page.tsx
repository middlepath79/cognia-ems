import { BookOpen, ClipboardCheck, GraduationCap, Users } from "lucide-react";
import Link from "next/link";
import PageHeading from "@/components/page-heading";
import { getCurrentSchool } from "@/lib/current-school";

const areas = [
  { label: "Students", href: "/admin/students", description: "View and manage student records.", icon: GraduationCap },
  { label: "Staff", href: "/admin/staff", description: "Manage teaching and school staff.", icon: Users },
  { label: "Attendance", href: "/admin/attendance", description: "Review attendance across the school.", icon: ClipboardCheck },
  { label: "Academics", href: "/admin/academics", description: "Organise classes and assessments.", icon: BookOpen },
];

export default async function DashboardPage() {
  const { school } = await getCurrentSchool();
  return (
    <>
      <PageHeading title="Dashboard" description={`${school.name} administration overview.`} />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {areas.map(({ label, href, description, icon: Icon }) => (
          <Link className="card block p-5 transition-colors hover:border-indigo-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600" href={href} key={label}>
            <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
              <Icon size={19} />
            </div>
            <h2 className="text-sm font-bold text-slate-800">{label}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
          </Link>
        ))}
      </section>
    </>
  );
}
