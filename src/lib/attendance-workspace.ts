import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_SCHOOL_COOKIE } from "@/lib/school-workspace";
import { createClient } from "@/lib/supabase/server";

export async function getCurrentAttendanceSchool() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (typeof userId !== "string") redirect("/login");
  const cookieStore = await cookies();
  const selectedId = cookieStore.get(ACTIVE_SCHOOL_COOKIE)?.value;
  let membershipQuery = supabase.from("school_memberships").select("school_id, role").eq("user_id", userId).eq("status", "active").in("role", ["school_admin", "teacher"]);
  if (selectedId) membershipQuery = membershipQuery.eq("school_id", selectedId);
  const { data: memberships, error: membershipError } = await membershipQuery.order("role").limit(10);
  if (membershipError) {
    console.error("Unable to verify attendance membership", membershipError.message);
    redirect("/portal");
  }
  const membership = memberships?.find((row) => row.role === "school_admin") ?? memberships?.[0];
  if (!membership) redirect("/portal");
  const { data: school, error } = await supabase.from("schools").select("id,name,status,institution_type,academic_period_label").eq("id", membership.school_id).maybeSingle();
  if (error || !school || school.status !== "active") redirect("/portal");
  return { supabase, school, userId, role: membership.role as "school_admin" | "teacher" };
}
