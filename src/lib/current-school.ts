import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_SCHOOL_COOKIE } from "@/lib/school-workspace";

export async function getCurrentSchool() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (typeof userId !== "string") redirect("/login");
  const cookieStore = await cookies();
  const schoolId = cookieStore.get(ACTIVE_SCHOOL_COOKIE)?.value;
  const { data: memberships, error: membershipError } = await supabase
    .from("school_memberships")
    .select("school_id")
    .eq("user_id", userId)
    .eq("role", "school_admin")
    .eq("status", "active");
  if (membershipError) {
    console.error("Unable to verify school administrator membership", membershipError.message);
    redirect("/access-denied");
  }
  const schoolIds = (memberships ?? []).map((membership) => membership.school_id);
  if (!schoolIds.length) redirect("/staff");

  const { data: schools, error: schoolError } = await supabase
    .from("schools")
    .select("id, name, status, institution_type, academic_period_label, logo_url")
    .in("id", schoolIds);
  if (schoolError) {
    console.error("Unable to verify institution status", schoolError.message);
    redirect("/access-denied");
  }
  const approvedSchools = (schools ?? []).filter((school) => school.status === "active");
  const selectedSchool = approvedSchools.find((school) => school.id === schoolId);
  if (!selectedSchool && approvedSchools.length > 1) redirect("/admin");
  if (!selectedSchool && !approvedSchools.length) {
    if ((schools ?? []).some((school) => school.status === "pending_review")) redirect("/school-review");
    redirect("/access-denied");
  }
  const school = selectedSchool ?? approvedSchools[0];
  return { supabase, userId, school };
}
