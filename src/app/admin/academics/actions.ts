"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSchool } from "@/lib/current-school";

export type AcademicActionState = { error?: string; success?: string };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readDate(value: FormDataEntryValue | null) {
  const date = String(value ?? "");
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ? date : "";
}

function failure(message: string): AcademicActionState {
  return { error: message };
}

function databaseFailure(error: { code?: string; message: string }, duplicateMessage: string) {
  if (error.code === "23505") return duplicateMessage;
  if (error.code === "23503") return "This record is still in use and cannot be deleted or reassigned.";
  return error.message;
}

export async function saveSessionAction(_state: AcademicActionState, formData: FormData): Promise<AcademicActionState> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const startsOn = readDate(formData.get("startsOn"));
  const endsOn = readDate(formData.get("endsOn"));
  if ((id && !uuidPattern.test(id)) || name.length < 4 || name.length > 32 || !startsOn || !endsOn || startsOn > endsOn) {
    return failure("Enter a session name and valid opening and closing dates.");
  }

  const { supabase, school } = await getCurrentSchool();
  if (id) {
    const { data: activeTerms, error: termsError } = await supabase.from("academic_terms").select("id, starts_on, ends_on").eq("school_id", school.id).eq("academic_session_id", id);
    if (termsError) return failure(`Could not check the session terms: ${termsError.message}`);
    if (activeTerms?.some((term) => term.starts_on < startsOn || term.ends_on > endsOn)) {
      return failure("The session dates must contain all existing academic period dates.");
    }
    const { data, error } = await supabase.from("academic_sessions").update({ name, starts_on: startsOn, ends_on: endsOn }).eq("id", id).eq("school_id", school.id).select("id").maybeSingle();
    if (error) return failure(databaseFailure(error, "A session with this name already exists."));
    if (!data) return failure("That session was not found in this school.");
  } else {
    const { error } = await supabase.from("academic_sessions").insert({ school_id: school.id, name, starts_on: startsOn, ends_on: endsOn });
    if (error) return failure(databaseFailure(error, "A session with this name already exists."));
  }
  revalidatePath("/admin");
  revalidatePath("/admin/academics");
  return { success: id ? "Session updated." : "Session created." };
}

export async function setActiveSessionAction(_state: AcademicActionState, formData: FormData): Promise<AcademicActionState> {
  const id = String(formData.get("id") ?? "");
  if (!uuidPattern.test(id)) return failure("Choose a valid academic session.");
  const { supabase, school } = await getCurrentSchool();
  const { error } = await supabase.rpc("set_active_academic_session", { target_school_id: school.id, target_session_id: id });
  if (error) return failure(`The active session was not changed: ${error.message}`);
  revalidatePath("/admin");
  revalidatePath("/admin/academics");
  return { success: "Active session updated." };
}

export async function deleteSessionAction(_state: AcademicActionState, formData: FormData): Promise<AcademicActionState> {
  const id = String(formData.get("id") ?? "");
  if (!uuidPattern.test(id)) return failure("Choose a valid academic session.");
  const { supabase, school } = await getCurrentSchool();
  const { data, error } = await supabase.from("academic_sessions").delete().eq("id", id).eq("school_id", school.id).select("id").maybeSingle();
  if (error) return failure(`The session could not be deleted: ${error.message}`);
  if (!data) return failure("That session was not found in this school.");
  revalidatePath("/admin");
  revalidatePath("/admin/academics");
  return { success: "Session and its terms deleted." };
}

export async function saveTermAction(_state: AcademicActionState, formData: FormData): Promise<AcademicActionState> {
  const id = String(formData.get("id") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const startsOn = readDate(formData.get("startsOn"));
  const endsOn = readDate(formData.get("endsOn"));
  if ((id && !uuidPattern.test(id)) || !uuidPattern.test(sessionId) || name.length < 1 || name.length > 48 || !startsOn || !endsOn || startsOn > endsOn) {
    return failure("Choose a session, academic period name and valid opening and closing dates.");
  }

  const { supabase, school } = await getCurrentSchool();
  const { data: session, error: sessionError } = await supabase.from("academic_sessions").select("id, starts_on, ends_on, is_active").eq("id", sessionId).eq("school_id", school.id).maybeSingle();
  if (sessionError) return failure(`Could not verify the academic session: ${sessionError.message}`);
  if (!session) return failure("Choose a session belonging to this school.");
  if (startsOn < session.starts_on || endsOn > session.ends_on) return failure("Academic period dates must fall within the selected session dates.");

  const values = { school_id: school.id, academic_session_id: sessionId, name, starts_on: startsOn, ends_on: endsOn };
  if (id) {
    const { data: current, error: currentError } = await supabase.from("academic_terms").select("is_active").eq("id", id).eq("school_id", school.id).maybeSingle();
    if (currentError) return failure(`Could not verify the academic period: ${currentError.message}`);
    if (!current) return failure("That academic period was not found in this institution.");
    if (current.is_active && !session.is_active) return failure("An active academic period must stay in the active session. Activate another period before moving it.");
    const { error } = await supabase.from("academic_terms").update(values).eq("id", id).eq("school_id", school.id);
    if (error) return failure(databaseFailure(error, "This session already has a period with that name."));
  } else {
    const { error } = await supabase.from("academic_terms").insert(values);
    if (error) return failure(databaseFailure(error, "This session already has a period with that name."));
  }
  revalidatePath("/admin");
  revalidatePath("/admin/academics");
  return { success: id ? "Academic period updated." : "Academic period created." };
}

export async function setActiveTermAction(_state: AcademicActionState, formData: FormData): Promise<AcademicActionState> {
  const id = String(formData.get("id") ?? "");
  if (!uuidPattern.test(id)) return failure("Choose a valid academic period.");
  const { supabase, school } = await getCurrentSchool();
  const { error } = await supabase.rpc("set_active_academic_term", { target_school_id: school.id, target_term_id: id });
  if (error) return failure(`The active academic period was not changed: ${error.message}`);
  revalidatePath("/admin");
  revalidatePath("/admin/academics");
  return { success: "Active term updated." };
}

export async function deleteTermAction(_state: AcademicActionState, formData: FormData): Promise<AcademicActionState> {
  const id = String(formData.get("id") ?? "");
  if (!uuidPattern.test(id)) return failure("Choose a valid academic period.");
  const { supabase, school } = await getCurrentSchool();
  const { data, error } = await supabase.from("academic_terms").delete().eq("id", id).eq("school_id", school.id).select("id").maybeSingle();
  if (error) return failure(`The academic period could not be deleted: ${error.message}`);
  if (!data) return failure("That academic period was not found in this institution.");
  revalidatePath("/admin");
  revalidatePath("/admin/academics");
  return { success: "Academic period deleted." };
}
