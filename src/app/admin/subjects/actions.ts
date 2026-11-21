"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSchool } from "@/lib/current-school";
import type { AcademicActionState } from "../academics/actions";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function result(message: string): AcademicActionState { return { error: message }; }

export async function saveDepartmentAction(_state: AcademicActionState, formData: FormData): Promise<AcademicActionState> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if ((id && !uuidPattern.test(id)) || name.length < 1 || name.length > 80 || description.length > 500) return result("Enter a department name and a description under 500 characters.");
  const { supabase, school } = await getCurrentSchool();
  const query = id
    ? await supabase.from("departments").update({ name, description: description || null }).eq("id", id).eq("school_id", school.id).select("id").maybeSingle()
    : await supabase.from("departments").insert({ school_id: school.id, name, description: description || null }).select("id").maybeSingle();
  if (query.error) return result(query.error.code === "23505" ? "A department with that name already exists." : query.error.message);
  if (!query.data) return result("The department could not be found in this school.");
  revalidatePath("/admin/subjects");
  return { success: id ? "Department updated." : "Department created." };
}

export async function deleteDepartmentAction(_state: AcademicActionState, formData: FormData): Promise<AcademicActionState> {
  const id = String(formData.get("id") ?? "");
  if (!uuidPattern.test(id)) return result("Choose a valid department.");
  const { supabase, school } = await getCurrentSchool();
  const { data, error } = await supabase.from("departments").delete().eq("id", id).eq("school_id", school.id).select("id").maybeSingle();
  if (error) return result(error.code === "23503" ? "This department has subjects. Move or unassign them before deleting it." : `The department could not be deleted: ${error.message}`);
  if (!data) return result("The department could not be found in this school.");
  revalidatePath("/admin/subjects");
  return { success: "Department deleted." };
}

export async function saveSubjectAction(_state: AcademicActionState, formData: FormData): Promise<AcademicActionState> {
  const id = String(formData.get("id") ?? "");
  const departmentId = String(formData.get("departmentId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if ((id && !uuidPattern.test(id)) || (departmentId && !uuidPattern.test(departmentId)) || name.length < 1 || name.length > 120 || code.length > 32 || description.length > 500) return result("Enter a subject name and valid optional code, department and description.");
  const { supabase, school } = await getCurrentSchool();
  if (departmentId) {
    const { data: department, error } = await supabase.from("departments").select("id").eq("id", departmentId).eq("school_id", school.id).maybeSingle();
    if (error) return result(`Could not verify the department: ${error.message}`);
    if (!department) return result("Choose a department belonging to this school.");
  }
  const values = { school_id: school.id, department_id: departmentId || null, name, code: code || null, description: description || null };
  const query = id
    ? await supabase.from("subjects").update(values).eq("id", id).eq("school_id", school.id).select("id").maybeSingle()
    : await supabase.from("subjects").insert(values).select("id").maybeSingle();
  if (query.error) return result(query.error.code === "23505" ? "A subject with that name or code already exists in this school." : query.error.message);
  if (!query.data) return result("The subject could not be found in this school.");
  revalidatePath("/admin/subjects");
  return { success: id ? "Subject updated." : "Subject created." };
}

export async function deleteSubjectAction(_state: AcademicActionState, formData: FormData): Promise<AcademicActionState> {
  const id = String(formData.get("id") ?? "");
  if (!uuidPattern.test(id)) return result("Choose a valid subject.");
  const { supabase, school } = await getCurrentSchool();
  const { data, error } = await supabase.from("subjects").delete().eq("id", id).eq("school_id", school.id).select("id").maybeSingle();
  if (error) return result(`The subject could not be deleted: ${error.message}`);
  if (!data) return result("The subject could not be found in this school.");
  revalidatePath("/admin/subjects");
  return { success: "Subject deleted." };
}
