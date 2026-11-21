"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSchool } from "@/lib/current-school";
import type { AcademicActionState } from "../academics/actions";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function result(message: string): AcademicActionState { return { error: message }; }
function readOrder(value: FormDataEntryValue | null) { const order = Number(value ?? 0); return Number.isInteger(order) && order >= 0 && order <= 9999 ? order : null; }

export async function saveClassAction(_state: AcademicActionState, formData: FormData): Promise<AcademicActionState> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const sortOrder = readOrder(formData.get("sortOrder"));
  if ((id && !uuidPattern.test(id)) || name.length < 1 || name.length > 60 || sortOrder === null) return result("Enter a class name and valid order number.");
  const { supabase, school } = await getCurrentSchool();
  const query = id
    ? await supabase.from("school_classes").update({ name, sort_order: sortOrder }).eq("id", id).eq("school_id", school.id).select("id").maybeSingle()
    : await supabase.from("school_classes").insert({ school_id: school.id, name, sort_order: sortOrder }).select("id").maybeSingle();
  if (query.error) return result(query.error.code === "23505" ? "A class with that name already exists." : query.error.message);
  if (!query.data) return result("The class could not be found in this school.");
  revalidatePath("/admin/classes");
  return { success: id ? "Class updated." : "Class created." };
}

export async function deleteClassAction(_state: AcademicActionState, formData: FormData): Promise<AcademicActionState> {
  const id = String(formData.get("id") ?? "");
  if (!uuidPattern.test(id)) return result("Choose a valid class.");
  const { supabase, school } = await getCurrentSchool();
  const { data, error } = await supabase.from("school_classes").delete().eq("id", id).eq("school_id", school.id).select("id").maybeSingle();
  if (error) return result(`The class could not be deleted: ${error.message}`);
  if (!data) return result("The class could not be found in this school.");
  revalidatePath("/admin/classes");
  return { success: "Class and its arms deleted." };
}

export async function saveClassArmAction(_state: AcademicActionState, formData: FormData): Promise<AcademicActionState> {
  const id = String(formData.get("id") ?? "");
  const classId = String(formData.get("classId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const sortOrder = readOrder(formData.get("sortOrder"));
  if ((id && !uuidPattern.test(id)) || !uuidPattern.test(classId) || name.length < 1 || name.length > 32 || sortOrder === null) return result("Enter a class arm name and valid order number.");
  const { supabase, school } = await getCurrentSchool();
  const { data: parent, error: parentError } = await supabase.from("school_classes").select("id").eq("id", classId).eq("school_id", school.id).maybeSingle();
  if (parentError) return result(`Could not verify the class: ${parentError.message}`);
  if (!parent) return result("Choose a class belonging to this school.");
  const query = id
    ? await supabase.from("class_arms").update({ class_id: classId, name, sort_order: sortOrder }).eq("id", id).eq("school_id", school.id).select("id").maybeSingle()
    : await supabase.from("class_arms").insert({ school_id: school.id, class_id: classId, name, sort_order: sortOrder }).select("id").maybeSingle();
  if (query.error) return result(query.error.code === "23505" ? "That arm already exists in this class." : query.error.message);
  if (!query.data) return result("The class arm could not be found in this school.");
  revalidatePath("/admin/classes");
  return { success: id ? "Class arm updated." : "Class arm created." };
}

export async function deleteClassArmAction(_state: AcademicActionState, formData: FormData): Promise<AcademicActionState> {
  const id = String(formData.get("id") ?? "");
  if (!uuidPattern.test(id)) return result("Choose a valid class arm.");
  const { supabase, school } = await getCurrentSchool();
  const { data, error } = await supabase.from("class_arms").delete().eq("id", id).eq("school_id", school.id).select("id").maybeSingle();
  if (error) return result(`The class arm could not be deleted: ${error.message}`);
  if (!data) return result("The class arm could not be found in this school.");
  revalidatePath("/admin/classes");
  return { success: "Class arm deleted." };
}
