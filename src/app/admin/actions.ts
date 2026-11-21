"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_SCHOOL_COOKIE } from "@/lib/school-workspace";

export async function selectSchoolAction(formData: FormData) {
  const schoolId = String(formData.get("schoolId") ?? "");
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (typeof userId !== "string") redirect("/login");

  const { data: membership } = await supabase
    .from("school_memberships")
    .select("school_id")
    .eq("user_id", userId)
    .eq("school_id", schoolId)
    .eq("role", "school_admin")
    .eq("status", "active")
    .maybeSingle();
  if (!membership) redirect("/admin");

  const { data: school } = await supabase.from("schools").select("id, status").eq("id", membership.school_id).maybeSingle();
  if (school?.status !== "active") redirect("/school-review");

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_SCHOOL_COOKIE, school.id, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  redirect("/admin");
}
