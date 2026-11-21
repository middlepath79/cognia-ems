import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import AdminShell from "@/components/admin-shell";
import { createClient } from "@/lib/supabase/server";
import { SchoolSelector } from "@/components/school-selector";
import { ACTIVE_SCHOOL_COOKIE } from "@/lib/school-workspace";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (typeof userId !== "string") redirect("/login");

  const [membershipsResult, platformAdministratorResult] = await Promise.all([
    supabase.from("school_memberships").select("school_id, role").eq("user_id", userId).eq("status", "active"),
    supabase.from("platform_administrators").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);
  if (membershipsResult.error || platformAdministratorResult.error) {
    console.error("Unable to verify dashboard authorization", {
      membershipsError: membershipsResult.error?.message,
      platformAdministratorError: platformAdministratorResult.error?.message,
    });
    return <AuthorizationLookupError />;
  }

  const memberships = membershipsResult.data;
  const platformAdministrator = platformAdministratorResult.data;
  const adminMemberships = memberships?.filter((membership) => membership.role === "school_admin") ?? [];
  if (!adminMemberships.length) {
    if (platformAdministrator) redirect("/platform");
    const teacherMemberships = memberships?.filter((membership) => membership.role === "teacher") ?? [];
    const requestedPath = (await headers()).get("x-cognia-pathname");
    if (memberships?.length && requestedPath === "/admin/staff") return <StaffAccessDenied />;
    const teacherRoute = requestedPath === "/admin/attendance" || requestedPath === "/admin/timetable" || requestedPath === "/admin/assessments" || requestedPath?.startsWith("/admin/assessments/") || requestedPath === "/admin/examinations" || requestedPath?.startsWith("/admin/examinations/");
    if (teacherMemberships.length && teacherRoute) {
      const teacherSchoolIds = teacherMemberships.map((membership) => membership.school_id);
      const { data: teacherSchools, error: teacherSchoolsError } = await supabase.from("schools").select("id,name,status,institution_type,academic_period_label").in("id", teacherSchoolIds);
      if (teacherSchoolsError) return <AuthorizationLookupError/>;
      const availableSchools = (teacherSchools ?? []).filter((item) => item.status === "active" && teacherSchoolIds.includes(item.id));
      if (!availableSchools.length) redirect("/portal");
      const cookieStore = await cookies();
      const school = availableSchools.find((item) => item.id === cookieStore.get(ACTIVE_SCHOOL_COOKIE)?.value) ?? availableSchools[0];
      const [{ data: activeSession }, { data: activeTerm }] = await Promise.all([
        supabase.from("academic_sessions").select("id,name").eq("school_id",school.id).eq("is_active",true).maybeSingle(),
        supabase.from("academic_terms").select("name").eq("school_id",school.id).eq("is_active",true).maybeSingle(),
      ]);
      return <AdminShell school={school} schools={[]} academicSessionName={activeSession?.name ?? null} activeTermName={activeTerm?.name ?? null} teacherView>{children}</AdminShell>;
    }
    if (memberships?.length) redirect("/portal");
    redirect("/onboarding");
  }

  const schoolIds = adminMemberships.map((membership) => membership.school_id);
  const { data: schools, error: schoolsError } = await supabase.from("schools").select("id, name, status, institution_type, academic_period_label").in("id", schoolIds);
  if (schoolsError) {
    console.error("Unable to verify school approval status", schoolsError.message);
    return <AuthorizationLookupError />;
  }
  const authorizedSchools = (schools ?? []).filter((school) => schoolIds.includes(school.id));
  const approvedSchools = authorizedSchools.filter((school) => school.status === "active");
  const pendingSchools = authorizedSchools.filter((school) => school.status === "pending_review");
  if (!approvedSchools.length) {
    if (platformAdministrator) redirect("/platform");
    if (pendingSchools.length) redirect("/school-review");
    redirect("/portal?status=suspended");
  }

  const cookieStore = await cookies();
  const selectedId = cookieStore.get(ACTIVE_SCHOOL_COOKIE)?.value;
  const selectedSchool = approvedSchools.find((school) => school.id === selectedId);
  if (!selectedSchool && approvedSchools.length > 1) {
    return <SchoolSelector schools={approvedSchools} pendingSchools={pendingSchools} />;
  }

  const school = selectedSchool ?? approvedSchools[0];
  const [{ data: activeSession, error: sessionError }, { data: activeTerm, error: termError }] = await Promise.all([
    supabase.from("academic_sessions").select("id, name").eq("school_id", school.id).eq("is_active", true).maybeSingle(),
    supabase.from("academic_terms").select("name").eq("school_id", school.id).eq("is_active", true).maybeSingle(),
  ]);
  if (sessionError || termError) console.error("Unable to load active academic calendar", { sessionError: sessionError?.message, termError: termError?.message });
  return <AdminShell school={school} schools={approvedSchools} academicSessionName={activeSession?.name ?? null} activeTermName={activeTerm?.name ?? null} showPlatformAdministration={Boolean(platformAdministrator)}>{children}</AdminShell>;
}

function AuthorizationLookupError() {
  return <main className="grid min-h-screen place-items-center bg-slate-50 p-5"><section className="card max-w-lg p-8 text-center"><h1 className="text-xl font-bold text-slate-900">Access could not be verified</h1><p className="mt-3 text-sm leading-6 text-slate-500">We couldn’t verify your school or platform permissions. Please try again. If the problem continues, contact support.</p></section></main>;
}

function StaffAccessDenied() {
  return <main className="grid min-h-screen place-items-center bg-slate-50 p-5"><section className="card max-w-lg p-8 text-center" role="alert"><h1 className="text-xl font-bold text-slate-900">Access denied</h1><p className="mt-3 text-sm leading-6 text-slate-500">Only an active school administrator can open Staff Management.</p></section></main>;
}
