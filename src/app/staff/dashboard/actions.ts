"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateStaffContact } from "@/lib/staff-utils";

export type StaffContactState = { error?: string; success?: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function updateMyStaffContact(
  _previousState: StaffContactState,
  formData: FormData,
): Promise<StaffContactState> {
  const phoneValue = formData.get("phone");
  const addressValue = formData.get("address");
  const schoolId = formData.get("schoolId");
  if (typeof phoneValue !== "string" || typeof addressValue !== "string" || typeof schoolId !== "string" || !uuid.test(schoolId)) {
    return { error: "Enter a valid phone number and address." };
  }
  const values = { phone: phoneValue.trim(), address: addressValue.trim() };
  const validationError = validateStaffContact(values);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (typeof claims?.claims.sub !== "string") return { error: "Sign in again to update your profile." };

  const { error } = await supabase.rpc("update_my_staff_contact", {
    target_school_id: schoolId,
    target_phone: values.phone || null,
    target_address: values.address || null,
  });
  if (error) {
    console.error("Unable to update staff contact details", {
      code: error.code,
      message: error.message.slice(0, 300),
    });
    return { error: "Your contact details could not be updated. Refresh the page and try again." };
  }
  revalidatePath("/staff/dashboard");
  return { success: "Contact details updated." };
}
