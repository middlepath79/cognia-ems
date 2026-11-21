import { FileText, GraduationCap, Users, ChevronRight, CalendarDays, BarChart3, BookOpen, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import PageHeading from "@/components/page-heading";
import { getCurrentSchool } from "@/lib/current-school";

const reportCategories = [
  {
    label: "ACADEMIC PERFORMANCE",
    items: [
      { id: "student-performance", title: "Student Performance Report", description: "Individual and cohort performance across subjects and terms.", icon: GraduationCap },
      { id: "class-performance", title: "Class Performance Summary", description: "Aggregate performance metrics by class, arm, and programme.", icon: Users },
      { id: "subject-analysis", title: "Subject Analysis", description: "Performance breakdown and grade distribution by subject.", icon: BookOpen },
      { id: "gpa-trends", title: "GPA & CGPA Trends", description: "Institution GPA, CGPA and standing trends.", icon: BarChart3 },
    ],
  },
  {
    label: "ATTENDANCE & EXAMINATION",
    items: [
      { id: "attendance-summary", title: "Attendance Analytics", description: "Attendance rates, absence and lateness trends.", icon: CalendarDays },
      { id: "examination-results", title: "Examination Analysis", description: "Examination averages, ranges and publication status.", icon: ClipboardCheck },
      { id: "student-retention", title: "Student Retention", description: "Continued enrolment and student status trends.", icon: Users },
    ],
  },
  {
    label: "TRANSCRIPTS & CERTIFICATION",
    items: [
      { id: "transcript-register", title: "Transcript Register", description: "All issued transcripts with verification status.", icon: FileText },
      { id: "graduation-eligibility", title: "Graduation & Completion", description: "Completion decisions and graduation eligibility.", icon: GraduationCap },
    ],
  },
];

export default async function ReportsPage() {
  const { school } = await getCurrentSchool();
  return (
    <>
      <PageHeading
        title="Reports & Analytics"
        description={`Generate and export comprehensive reports for ${school.name}.`}
        action={
          <Link href="/admin/reports/builder" className="btn btn-primary">
            <span className="flex items-center gap-2"><FileText size={15} /><span>Custom Report Builder</span></span>
          </Link>
        }
      />
      <section className="space-y-8">
        {reportCategories.map((category) => (
          <div key={category.label}>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-[.15em] text-slate-500">{category.label}</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {category.items.map((report) => (
                <Link
                  key={report.id}
                  href={`/admin/reports/${report.id}`}
                  className="card block p-5 transition-colors hover:border-indigo-200 hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                    <report.icon size={19} />
                  </div>
                  <h2 className="text-sm font-bold text-slate-800">{report.title}</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{report.description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs font-medium text-indigo-600">View report</span>
                    <ChevronRight size={14} className="text-slate-400" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}