"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSchool } from "@/lib/current-school";
import { validateStaffForm, type StaffFormValues } from "@/lib/staff-utils";

export type StaffState = { error?: string; success?: string };

function formValues(form: FormData): StaffFormValues {
  const value = (key: string) => String(form.get(key) ?? "").trim();
  return {
    id: value("id"),
    userId: value("userId"),
    employeeNumber: value("employeeNumber"),
    firstName: value("firstName"),
    middleName: value("middleName"),
    surname: value("surname"),
    email: value("email"),
    phone: value("phone"),
    profilePhotoUrl: value("profilePhotoUrl"),
    gender: value("gender"),
    dateOfBirth: value("dateOfBirth"),
    address: value("address"),
    staffCategory: value("staffCategory"),
    reportingManagerId: value("reportingManagerId"),
    departmentId: value("departmentId"),
    designation: value("designation"),
    employmentStatus: value("employmentStatus"),
    employmentType: value("employmentType"),
    joinedOn: value("joinedOn"),
    notes: value("notes"),
  };
}

function databaseError(operation: string, error: { code?: string; message?: string } | null) {
  console.error("Staff database operation failed", {
    operation,
    code: error?.code ?? "unknown",
    message: error?.message?.slice(0, 300),
  });
  if (["22P02", "42P01", "42703", "42704", "42883", "PGRST202", "PGRST204", "PGRST205"].includes(error?.code ?? "")) {
    return "The Staff schema is unavailable. Apply the COGNIA staff migrations and refresh the API schema cache.";
  }
  return "Staff data could not be saved. Refresh the page and try again.";
}

async function executeStaffQuery<T extends { error: { code?: string; message?: string } | null }>(
  operation: string,
  query: PromiseLike<T>,
): Promise<T | null> {
  try {
    return await query;
  } catch (error) {
    console.error("Staff database request failed", {
      operation,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return null;
  }
}

export async function saveStaffRecord(_state: StaffState, form: FormData): Promise<StaffState> {
  const values = formValues(form);
  const validationError = validateStaffForm(values);
  if (validationError) return { error: validationError };

  const { supabase, school, userId: actor } = await getCurrentSchool();

  const existingQuery = values.id
    ? supabase
        .from("staff_records")
        .select("id,user_id,account_status")
        .eq("id", values.id)
        .eq("school_id", school.id)
        .maybeSingle()
    : null;
  const existingResult = existingQuery
    ? await executeStaffQuery("find staff profile", existingQuery)
    : { data: null, error: null };
  if (!existingResult) return { error: "Staff data could not be loaded. Refresh the page and try again." };
  const { data: existing, error: existingError } = existingResult;
  if (existingError) return { error: databaseError("find staff profile", existingError) };
  if (values.id && !existing) return { error: "This staff profile is no longer available in this institution. Refresh the page and try again." };

  if (values.userId) {
    const membershipResult = await executeStaffQuery("verify membership", supabase
      .from("school_memberships")
      .select("user_id,role")
      .eq("school_id", school.id)
      .eq("user_id", values.userId)
      .in("status", values.id ? ["active", "suspended"] : ["active"])
      .in("role", ["teacher", "staff", "school_admin"])
      .maybeSingle());

    if (!membershipResult) return { error: "Staff membership could not be verified. Refresh the page and try again." };
    const { data: membership, error: membershipError } = membershipResult;
    if (membershipError) return { error: databaseError("verify membership", membershipError) };
    if (!membership) return { error: "Select an active staff membership in this institution." };
    const expectedRole = values.staffCategory === "teaching" ? "teacher" : "staff";
    if (membership.role !== "school_admin" && membership.role !== expectedRole) {
      return { error: `This account's role does not match the ${values.staffCategory.replaceAll("_", " ")} staff category.` };
    }

    if (!existing || values.userId !== existing.user_id) {
      let linkedProfileQuery = supabase
        .from("staff_records")
        .select("id")
        .eq("school_id", school.id)
        .eq("user_id", values.userId);
      if (existing) linkedProfileQuery = linkedProfileQuery.neq("id", existing.id);
      const linkedProfileResult = await executeStaffQuery("check linked staff profile", linkedProfileQuery.maybeSingle());
      if (!linkedProfileResult) return { error: "The linked staff profile could not be verified. Refresh the page and try again." };
      if (linkedProfileResult.error) return { error: databaseError("check linked staff profile", linkedProfileResult.error) };
      if (linkedProfileResult.data) {
        return { error: "This account already has a staff profile in this institution. Edit that profile instead." };
      }
    }
  }

  if (values.departmentId) {
    const departmentResult = await executeStaffQuery("verify department", supabase
      .from("departments")
      .select("id")
      .eq("id", values.departmentId)
      .eq("school_id", school.id)
      .maybeSingle());
    if (!departmentResult) return { error: "Department could not be verified. Refresh the page and try again." };
    const { data: department, error: departmentError } = departmentResult;
    if (departmentError) return { error: databaseError("verify department", departmentError) };
    if (!department) return { error: "Choose a department belonging to this institution." };
  }

  if (values.reportingManagerId) {
    const managerResult = await executeStaffQuery("verify reporting manager", supabase
      .from("staff_records")
      .select("id")
      .eq("id", values.reportingManagerId)
      .eq("school_id", school.id)
      .maybeSingle());
    if (!managerResult) return { error: "Reporting manager could not be verified. Refresh the page and try again." };
    const { data: manager, error: managerError } = managerResult;
    if (managerError) return { error: databaseError("verify reporting manager", managerError) };
    if (!manager || manager.id === values.id) return { error: "Choose another staff member as the reporting manager." };
  }

  const record = {
    user_id: values.userId || existing?.user_id || null,
    employee_number: values.employeeNumber,
    first_name: values.firstName,
    middle_name: values.middleName || null,
    surname: values.surname,
    email: values.email.toLowerCase() || null,
    phone: values.phone || null,
    profile_photo_url: values.profilePhotoUrl || null,
    gender: values.gender || null,
    date_of_birth: values.dateOfBirth || null,
    address: values.address || null,
    staff_category: values.staffCategory,
    department_id: values.departmentId || null,
    reporting_manager_id: values.reportingManagerId || null,
    designation: values.designation || null,
    employment_status: values.employmentStatus,
    employment_type: values.employmentType,
    joined_on: values.joinedOn || null,
    notes: values.notes || null,
    account_status: values.userId || existing?.user_id
      ? existing?.account_status === "deactivated" ? "deactivated" : "active"
      : existing?.account_status ?? "pending",
  };

  const query = existing
    ? supabase
        .from("staff_records")
        .update(record)
        .eq("id", existing.id)
        .eq("school_id", school.id)
        .select("id")
        .maybeSingle()
    : supabase
        .from("staff_records")
        .insert({ ...record, school_id: school.id, created_by: actor })
        .select("id")
        .maybeSingle();
  const saveResult = await executeStaffQuery("save staff profile", query);
  if (!saveResult) return { error: "Staff data could not be saved. Refresh the page and try again." };
  const { data, error } = saveResult;
  if (error || !data) {
    if (error?.code === "23505") return { error: "The employee ID, email, or linked account already exists in this institution." };
    return { error: databaseError("save staff profile", error) };
  }

  revalidatePath("/admin/staff");
  return {
    success: existing ? "Staff profile updated." : "Staff profile created. Create an invitation separately when the employee is ready for account access.",
  };
}

export async function setStaffAccountStatusAction(
  _state: StaffState,
  form: FormData,
): Promise<StaffState> {
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["active", "deactivated"].includes(status)) {
    return { error: "Choose a valid staff account and status." };
  }
  const { supabase } = await getCurrentSchool();
  const { error } = await supabase.rpc("set_staff_account_status", {
    target_staff_record_id: id,
    target_status: status,
  });
  if (error) {
    console.error("Unable to update staff account status", {
      code: error.code,
      message: error.message.slice(0, 300),
    });
    if (["22P02", "42P01", "42703", "42704", "42883", "PGRST202", "PGRST204", "PGRST205"].includes(error.code)) {
      return { error: "The Staff schema or account function is unavailable. Apply the COGNIA staff migrations and refresh the API schema cache." };
    }
    return { error: "The staff account status could not be changed. Refresh the page and try again." };
  }
  revalidatePath("/admin/staff");
  return { success: status === "active" ? "Staff account activated." : "Staff account deactivated." };
}
