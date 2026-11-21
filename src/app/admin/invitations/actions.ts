"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type InvitationActionState = { error?: string; token?: string };
export type InvitationRevocationState = { error?: string; success?: string };

export async function createInvitationAction(_previous: InvitationActionState, formData: FormData): Promise<InvitationActionState> {
  const schoolId = String(formData.get("schoolId") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(schoolId) || !/^\S+@\S+\.\S+$/.test(email)) {
    return { error: "Choose a school and enter a valid email address." };
  }
  if (!(["school_admin", "teacher", "staff", "student", "parent"] as const).includes(role as "school_admin" | "teacher" | "staff" | "student" | "parent")) {
    return { error: "Choose a valid school role." };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (typeof claims?.claims.sub !== "string") return { error: "Sign in again to create an invitation." };
  const { data: membership } = await supabase
    .from("school_memberships")
    .select("id")
    .eq("school_id", schoolId)
    .eq("user_id", claims.claims.sub)
    .eq("role", "school_admin")
    .eq("status", "active")
    .maybeSingle();
  if (!membership) return { error: "You do not have administrator access to that school." };

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { error } = await supabase.rpc("create_school_invitation", {
    target_school_id: schoolId,
    invite_email: email,
    invite_role: role,
    invite_token_hash: tokenHash,
  });
  if (error) return { error: "The invitation could not be created. Check the email and try again." };
  return { token };
}

export async function revokeInvitationAction(
  _previous: InvitationRevocationState,
  formData: FormData,
): Promise<InvitationRevocationState> {
  const id = String(formData.get("invitationId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Choose a valid invitation." };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (typeof claims?.claims.sub !== "string") return { error: "Sign in again to manage invitations." };
  const { error } = await supabase.rpc("revoke_school_invitation", { invitation_id: id });
  if (error) {
    console.error("Unable to revoke school invitation", {
      code: error.code,
      message: error.message.slice(0, 300),
    });
    return { error: "The invitation could not be revoked. Refresh the page and try again." };
  }
  revalidatePath("/admin/invitations");
  revalidatePath("/admin/staff");
  return { success: "Invitation revoked." };
}
