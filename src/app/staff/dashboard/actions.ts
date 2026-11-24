"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStaffContext } from "@/lib/current-staff";
import { validateStaffContact } from "@/lib/staff-utils";

export type StaffContactState = { error?: string; success?: string };

export async function updateMyStaffContact(
  _previousState: StaffContactState,
  formData: FormData,
): Promise<StaffContactState> {
  const phoneValue = formData.get("phone");
  const addressValue = formData.get("address");
  if (typeof phoneValue !== "string" || typeof addressValue !== "string") {
    return { error: "Enter a valid phone number and address." };
  }
  const values = { phone: phoneValue.trim(), address: addressValue.trim() };
  const validationError = validateStaffContact(values);
  if (validationError) return { error: validationError };

  const { supabase, school } = await getCurrentStaffContext();

  const { error } = await supabase.rpc("update_my_staff_contact", {
    target_school_id: school.id,
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
  revalidatePath("/staff");
  revalidatePath("/staff/dashboard");
  revalidatePath("/staff/profile");
  return { success: "Contact details updated." };
}
