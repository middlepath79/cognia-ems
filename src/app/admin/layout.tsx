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

  const memberships = membershipsResult.data ?? [];
  const platformAdministrator = platformAdministratorResult.data;
  const adminMemberships = memberships.filter((membership) => membership.role === "school_admin");
  const candidateTeacherMemberships = memberships.filter((membership) => membership.role === "teacher");
  let teacherMemberships = candidateTeacherMemberships;
  if (candidateTeacherMemberships.length) {
    const { data: teachingStaffRecords, error: teachingStaffError } = await supabase
      .from("staff_records")
      .select("school_id")
      .eq("user_id", userId)
      .eq("account_status", "active")
      .eq("staff_category", "teaching")
      .in("school_id", candidateTeacherMemberships.map((membership) => membership.school_id));
    if (teachingStaffError) {
      console.error("Unable to verify teaching staff access", teachingStaffError.message);
      return <AuthorizationLookupError />;
    }
    const teachingSchoolIds = new Set((teachingStaffRecords ?? []).map((record) => record.school_id));
    teacherMemberships = candidateTeacherMemberships.filter((membership) => teachingSchoolIds.has(membership.school_id));
  }
  const requestedPath = (await headers()).get("x-cognia-pathname");
  const teacherRoute = requestedPath === "/admin/attendance" ||
    requestedPath === "/admin/timetable" ||
    requestedPath === "/admin/assessments" ||
    requestedPath?.startsWith("/admin/assessments/") ||
    requestedPath === "/admin/examinations" ||
    requestedPath?.startsWith("/admin/examinations/");
  const cookieStore = await cookies();
  const selectedSchoolId = cookieStore.get(ACTIVE_SCHOOL_COOKIE)?.value;
  const selectedAdminMembership = adminMemberships.find((membership) => membership.school_id === selectedSchoolId);
  const selectedTeacherMembership = teacherMemberships.find((membership) => membership.school_id === selectedSchoolId);
  if (teacherRoute && selectedTeacherMembership && !selectedAdminMembership) {
    return (
      <TeacherWorkspaceShell
        supabase={supabase}
        schoolIds={[selectedTeacherMembership.school_id]}
        selectedSchoolId={selectedSchoolId}
      >
        {children}
      </TeacherWorkspaceShell>
    );
  }
  if (!adminMemberships.length) {
    if (platformAdministrator) redirect("/platform");
    if (teacherMemberships.length && teacherRoute) {
      return <TeacherWorkspaceShell supabase={supabase} schoolIds={teacherMemberships.map((membership) => membership.school_id)} selectedSchoolId={selectedSchoolId}>{children}</TeacherWorkspaceShell>;
    }
    if (memberships.some((membership) => membership.role === "teacher" || membership.role === "staff")) redirect("/staff");
    if (memberships.length) redirect("/portal");
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

  const selectedSchool = approvedSchools.find((school) => school.id === selectedSchoolId);
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

type ServerClient = Awaited<ReturnType<typeof createClient>>;

async function TeacherWorkspaceShell({
  supabase,
  schoolIds,
  selectedSchoolId,
  children,
}: {
  supabase: ServerClient;
  schoolIds: string[];
  selectedSchoolId?: string;
  children: React.ReactNode;
}) {
  const { data: teacherSchools, error: teacherSchoolsError } = await supabase
    .from("schools")
    .select("id,name,status,institution_type,academic_period_label")
    .in("id", schoolIds);
  if (teacherSchoolsError) {
    console.error("Unable to verify teaching institution", teacherSchoolsError.message);
    return <AuthorizationLookupError />;
  }
  const availableSchools = (teacherSchools ?? []).filter(
    (school) => school.status === "active" && schoolIds.includes(school.id),
  );
  if (!availableSchools.length) redirect("/access-denied");
  const selectedSchool = availableSchools.find((school) => school.id === selectedSchoolId);
  if (!selectedSchool && availableSchools.length > 1) redirect("/workspace/select");
  const school = selectedSchool ?? availableSchools[0];
  const [{ data: activeSession }, { data: activeTerm }] = await Promise.all([
    supabase.from("academic_sessions").select("id,name").eq("school_id", school.id).eq("is_active", true).maybeSingle(),
    supabase.from("academic_terms").select("name").eq("school_id", school.id).eq("is_active", true).maybeSingle(),
  ]);
  return (
    <AdminShell
      school={school}
      schools={[]}
      academicSessionName={activeSession?.name ?? null}
      activeTermName={activeTerm?.name ?? null}
      teacherView
    >
      {children}
    </AdminShell>
  );
}

function AuthorizationLookupError() {
  return <main className="grid min-h-screen place-items-center bg-slate-50 p-5"><section className="card max-w-lg p-8 text-center"><h1 className="text-xl font-bold text-slate-900">Access could not be verified</h1><p className="mt-3 text-sm leading-6 text-slate-500">We couldn’t verify your school or platform permissions. Please try again. If the problem continues, contact support.</p></section></main>;
}
