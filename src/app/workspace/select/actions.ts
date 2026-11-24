"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_SCHOOL_COOKIE } from "@/lib/school-workspace";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function selectWorkspaceAction(formData: FormData) {
  const schoolId = String(formData.get("schoolId") ?? "");
  if (!uuid.test(schoolId)) redirect("/access-denied");

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (typeof userId !== "string") redirect("/login");

  const { data: membership, error: membershipError } = await supabase
    .from("school_memberships")
    .select("role,status")
    .eq("school_id", schoolId)
    .eq("user_id", userId)
    .maybeSingle();
  if (membershipError) {
    console.error("Unable to verify selected workspace membership", membershipError.message);
    redirect("/access-denied");
  }
  if (!membership || membership.status !== "active") redirect("/access-denied");

  const { data: school, error: schoolError } = await supabase
    .from("schools")
    .select("id,status")
    .eq("id", schoolId)
    .maybeSingle();
  if (schoolError || !school) {
    if (schoolError) console.error("Unable to verify selected institution", schoolError.message);
    redirect("/access-denied");
  }

  let destination: string;
  if (membership.role === "school_admin" && school.status === "pending_review") {
    destination = "/school-review";
  } else if (school.status !== "active") {
    redirect("/access-denied");
  } else if (membership.role === "school_admin") {
    destination = "/admin";
  } else if (membership.role === "teacher" || membership.role === "staff") {
    const { data: staff, error: staffError } = await supabase
      .from("staff_records")
      .select("id")
      .eq("school_id", schoolId)
      .eq("user_id", userId)
      .eq("account_status", "active")
      .maybeSingle();
    if (staffError || !staff) {
      if (staffError) console.error("Unable to verify selected staff profile", staffError.message);
      redirect("/access-denied");
    }
    destination = "/staff";
  } else if (membership.role === "student" || membership.role === "parent") {
    destination = "/portal";
  } else {
    redirect("/access-denied");
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_SCHOOL_COOKIE, schoolId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect(destination);
}
