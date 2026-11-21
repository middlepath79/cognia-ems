"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createSchoolAction(formData: FormData) {
  const name = String(formData.get("schoolName") ?? "").trim();
  const slug = String(formData.get("schoolSlug") ?? "").trim().toLowerCase();
  const institutionType = String(formData.get("institutionType") ?? "");
  const allowedInstitutionTypes = new Set([
    "early_childhood", "basic", "secondary", "technical_vocational", "college",
    "polytechnic", "monotechnic", "university", "postgraduate", "professional_research", "mixed",
  ]);
  if (name.length < 2 || name.length > 160 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !allowedInstitutionTypes.has(institutionType)) {
    redirect("/onboarding?error=invalid");
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (typeof claims?.claims.sub !== "string") redirect("/login");

  const { error } = await supabase.rpc("create_institution_onboarding", {
    institution_name: name,
    institution_slug: slug,
    selected_institution_type: institutionType,
  });
  if (error) {
    const code = error.code === "23505" ? "slug-taken" : "failed";
    redirect(`/onboarding?error=${code}`);
  }
  redirect("/school-review");
}
