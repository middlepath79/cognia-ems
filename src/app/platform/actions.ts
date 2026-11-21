"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function approveSchoolAction(formData: FormData) {
  const schoolId = String(formData.get("schoolId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(schoolId)) redirect("/platform?error=invalid");
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (typeof claims?.claims.sub !== "string") redirect("/login");
  const { data: platformAdministrator, error: platformAdministratorError } = await supabase.from("platform_administrators").select("user_id").eq("user_id", claims.claims.sub).maybeSingle();
  if (platformAdministratorError) {
    console.error("Unable to verify platform administrator access for school approval", platformAdministratorError.message);
    redirect("/platform?error=authorization-check");
  }
  if (!platformAdministrator) redirect("/admin");
  const { error } = await supabase.rpc("approve_school_onboarding", { target_school_id: schoolId });
  if (error) redirect("/platform?error=review");
  revalidatePath("/platform");
  redirect("/platform?approved=1");
}
