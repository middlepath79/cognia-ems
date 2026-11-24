"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceDestination, type WorkspaceMembership } from "@/lib/auth-routing";
import { cookies } from "next/headers";
import { ACTIVE_SCHOOL_COOKIE } from "@/lib/school-workspace";
import { loadWorkspaceMemberships } from "@/lib/workspace-memberships";

export async function resolvePostLoginRoute(): Promise<string> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (typeof userId !== "string") return "/login";

  const [{ data: platformAdmin, error: platformError }, workspaceResult] =
    await Promise.all([
      supabase.from("platform_administrators").select("user_id").eq("user_id", userId).maybeSingle(),
      loadWorkspaceMemberships(supabase, userId),
    ]);

  if (platformError || workspaceResult.error) {
    console.error("Unable to resolve authenticated workspace", {
      platformError: platformError?.message,
      membershipError: workspaceResult.error?.message,
    });
    return "/access-denied";
  }
  if (platformAdmin) return "/platform";

  if (!workspaceResult.memberships.length) return "/onboarding";
  const cookieStore = await cookies();
  return resolveWorkspaceDestination(
    workspaceResult.memberships as WorkspaceMembership[],
    cookieStore.get(ACTIVE_SCHOOL_COOKIE)?.value,
  );
}

export async function redirectToPostLoginRoute() {
  redirect(await resolvePostLoginRoute());
}
