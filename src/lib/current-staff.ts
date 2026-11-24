import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_SCHOOL_COOKIE } from "@/lib/school-workspace";
import { resolveWorkspaceDestination } from "@/lib/auth-routing";
import { loadWorkspaceMemberships } from "@/lib/workspace-memberships";

export const getCurrentStaffContext = cache(async function getCurrentStaffContext() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (typeof userId !== "string") redirect("/login");

  const { memberships, error } = await loadWorkspaceMemberships(supabase, userId);
  if (error) {
    console.error("Unable to verify personal staff workspace", error.message);
    redirect("/access-denied");
  }

  const cookieStore = await cookies();
  const selectedSchoolId = cookieStore.get(ACTIVE_SCHOOL_COOKIE)?.value;
  const overallDestination = resolveWorkspaceDestination(memberships, selectedSchoolId);
  if (overallDestination === "/workspace/select") redirect(overallDestination);

  const eligible = memberships.filter(
    (membership) =>
      membership.membershipStatus === "active" &&
      membership.institutionStatus === "active" &&
      membership.hasActiveStaffRecord &&
      ["teacher", "staff", "school_admin"].includes(membership.role),
  );
  const selectedMembership = selectedSchoolId
    ? memberships.find((item) => item.schoolId === selectedSchoolId)
    : undefined;
  const selectedStaffMembership = eligible.find((item) => item.schoolId === selectedSchoolId);
  if (
    selectedMembership &&
    resolveWorkspaceDestination([selectedMembership], selectedSchoolId) !== "/staff" &&
    !selectedStaffMembership
  ) {
    redirect(resolveWorkspaceDestination([selectedMembership], selectedSchoolId));
  }
  const membership = selectedMembership
    ? selectedStaffMembership
    : eligible.length === 1
      ? eligible[0]
      : null;

  if (!membership) {
    if (eligible.length > 1) redirect("/workspace/select");
    if (!memberships.length) redirect("/onboarding");
    if (overallDestination !== "/access-denied") redirect(overallDestination);
    redirect("/access-denied");
  }

  const [{ data: school, error: schoolError }, { data: staff, error: staffError }] = await Promise.all([
    supabase
      .from("schools")
      .select("id,name,status")
      .eq("id", membership.schoolId)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("staff_records")
      .select("id,employee_number,first_name,middle_name,surname,email,phone,profile_photo_url,gender,date_of_birth,address,staff_category,department_id,designation,employment_status,employment_type,joined_on,reporting_manager_id,account_status")
      .eq("school_id", membership.schoolId)
      .eq("user_id", userId)
      .eq("account_status", "active")
      .maybeSingle(),
  ]);
  if (schoolError || staffError) {
    console.error("Unable to load authenticated staff profile", {
      schoolError: schoolError?.message,
      staffError: staffError?.message,
    });
    redirect("/access-denied");
  }
  if (!school || !staff) redirect("/access-denied");
  return { supabase, userId, membership, school, staff };
});
