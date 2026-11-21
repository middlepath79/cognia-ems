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
  let query = supabase.from("school_memberships").select("school_id").eq("user_id", userId).eq("role", "school_admin").eq("status", "active");
  if (schoolId) query = query.eq("school_id", schoolId);
  const { data: membership } = await query.maybeSingle();
  if (!membership) redirect("/admin");
  const { data: school } = await supabase.from("schools").select("id, name, status, institution_type, academic_period_label, logo_url").eq("id", membership.school_id).maybeSingle();
  if (!school || school.status !== "active") redirect("/school-review");
  return { supabase, userId, school };
}
