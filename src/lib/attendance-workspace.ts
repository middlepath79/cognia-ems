import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_SCHOOL_COOKIE } from "@/lib/school-workspace";
import { createClient } from "@/lib/supabase/server";
import { matchesStaffCategoryForRole } from "@/lib/staff-utils";

export async function getCurrentAttendanceSchool() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (typeof userId !== "string") redirect("/login");
  const cookieStore = await cookies();
  const selectedId = cookieStore.get(ACTIVE_SCHOOL_COOKIE)?.value;
  const { data: memberships, error: membershipError } = await supabase
    .from("school_memberships")
    .select("school_id, role")
    .eq("user_id", userId)
    .eq("status", "active")
    .in("role", ["school_admin", "teacher"])
    .order("role");
  if (membershipError) {
    console.error("Unable to verify attendance membership", membershipError.message);
    redirect("/portal");
  }
  const membership = memberships?.find((row) => row.school_id === selectedId)
    ?? (memberships?.length === 1 ? memberships[0] : null);
  if (!membership && memberships?.length) redirect("/workspace/select");
  if (!membership) redirect("/portal");
  if (membership.role === "teacher") {
    const { data: staff, error: staffError } = await supabase
      .from("staff_records")
      .select("staff_category")
      .eq("school_id", membership.school_id)
      .eq("user_id", userId)
      .eq("account_status", "active")
      .maybeSingle();
    if (staffError) {
      console.error("Unable to verify teacher staff category", staffError.message);
      redirect("/access-denied");
    }
    if (!staff || !matchesStaffCategoryForRole(membership.role, staff.staff_category)) {
      redirect("/access-denied");
    }
  }
  const { data: school, error } = await supabase.from("schools").select("id,name,status,institution_type,academic_period_label").eq("id", membership.school_id).maybeSingle();
  if (error || !school || school.status !== "active") redirect("/portal");
  return { supabase, school, userId, role: membership.role as "school_admin" | "teacher" };
}
