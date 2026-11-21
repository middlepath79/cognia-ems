"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSchool } from "@/lib/current-school";
import type { AcademicActionState } from "../academics/actions";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const entities = ["faculties", "departments", "academic_programmes", "academic_levels", "subjects"] as const;
type Entity = (typeof entities)[number];

function failure(message: string): AcademicActionState { return { error: message }; }
function duplicate(error: { code?: string }, label: string) {
  return error.code === "23505" ? `A ${label} with that name or code already exists in this institution.` :
    error.code === "23503" ? "One of the selected academic records is no longer available." :
    "The record could not be saved. Check the values and try again.";
}
function readText(formData: FormData, key: string) { return String(formData.get(key) ?? "").trim(); }
function validOptionalId(value: string) { return value === "" || uuidPattern.test(value); }
function done(message: string): AcademicActionState { revalidatePath("/admin/academic-structure"); revalidatePath("/admin/subjects"); return { success: message }; }

async function verifyRelatedRecord(table: "faculties" | "departments" | "academic_programmes" | "academic_levels", id: string, schoolId: string) {
  if (!id) return true;
  const { supabase } = await getCurrentSchool();
  const { data, error } = await supabase.from(table).select("id").eq("id", id).eq("school_id", schoolId).maybeSingle();
  return !error && Boolean(data);
}

export async function saveFacultyAction(_state: AcademicActionState, formData: FormData): Promise<AcademicActionState> {
  const id = readText(formData, "id");
  const name = readText(formData, "name");
  const code = readText(formData, "code");
  if ((id && !uuidPattern.test(id)) || name.length < 1 || name.length > 120 || code.length > 24) return failure("Enter a faculty name and a code of up to 24 characters.");
  const { supabase, school } = await getCurrentSchool();
  const query = id
    ? await supabase.from("faculties").update({ name, code: code || null }).eq("id", id).eq("school_id", school.id).select("id").maybeSingle()
    : await supabase.from("faculties").insert({ school_id: school.id, name, code: code || null }).select("id").maybeSingle();
  if (query.error) return failure(duplicate(query.error, "faculty"));
  if (!query.data) return failure("That faculty was not found in this institution.");
  return done(id ? "Faculty updated." : "Faculty created.");
}

export async function saveDepartmentAction(_state: AcademicActionState, formData: FormData): Promise<AcademicActionState> {
  const id = readText(formData, "id");
  const facultyId = readText(formData, "facultyId");
  const name = readText(formData, "name");
  const description = readText(formData, "description");
  if ((id && !uuidPattern.test(id)) || !validOptionalId(facultyId) || name.length < 1 || name.length > 80 || description.length > 500) return failure("Enter a department name, valid optional faculty, and description under 500 characters.");
  const { supabase, school } = await getCurrentSchool();
  if (facultyId && !(await verifyRelatedRecord("faculties", facultyId, school.id))) return failure("Choose a faculty belonging to this institution.");
  const values = { faculty_id: facultyId || null, name, description: description || null };
  const query = id
    ? await supabase.from("departments").update(values).eq("id", id).eq("school_id", school.id).select("id").maybeSingle()
    : await supabase.from("departments").insert({ ...values, school_id: school.id }).select("id").maybeSingle();
  if (query.error) return failure(duplicate(query.error, "department"));
  if (!query.data) return failure("That department was not found in this institution.");
  return done(id ? "Department updated." : "Department created.");
}

export async function saveProgrammeAction(_state: AcademicActionState, formData: FormData): Promise<AcademicActionState> {
  const id = readText(formData, "id");
  const departmentId = readText(formData, "departmentId");
  const name = readText(formData, "name");
  const code = readText(formData, "code");
  const award = readText(formData, "award");
  const durationText = readText(formData, "durationYears");
  const duration = durationText ? Number(durationText) : null;
  if ((id && !uuidPattern.test(id)) || !validOptionalId(departmentId) || name.length < 1 || name.length > 160 || code.length > 32 || award.length > 120 || (duration !== null && (!Number.isFinite(duration) || duration <= 0 || duration > 99))) return failure("Enter a programme name and valid optional department, award, and duration.");
  const { supabase, school } = await getCurrentSchool();
  if (departmentId && !(await verifyRelatedRecord("departments", departmentId, school.id))) return failure("Choose a department belonging to this institution.");
  const values = { department_id: departmentId || null, name, code: code || null, award: award || null, duration_years: duration };
  const query = id
    ? await supabase.from("academic_programmes").update(values).eq("id", id).eq("school_id", school.id).select("id").maybeSingle()
    : await supabase.from("academic_programmes").insert({ ...values, school_id: school.id }).select("id").maybeSingle();
  if (query.error) return failure(duplicate(query.error, "programme"));
  if (!query.data) return failure("That programme was not found in this institution.");
  return done(id ? "Programme updated." : "Programme created.");
}

export async function saveLevelAction(_state: AcademicActionState, formData: FormData): Promise<AcademicActionState> {
  const id = readText(formData, "id");
  const programmeId = readText(formData, "programmeId");
  const name = readText(formData, "name");
  const sequence = Number(readText(formData, "sequence") || 0);
  if ((id && !uuidPattern.test(id)) || !validOptionalId(programmeId) || name.length < 1 || name.length > 80 || !Number.isInteger(sequence) || sequence < 0 || sequence > 9999) return failure("Enter a level name and valid optional programme and order.");
  const { supabase, school } = await getCurrentSchool();
  if (programmeId && !(await verifyRelatedRecord("academic_programmes", programmeId, school.id))) return failure("Choose a programme belonging to this institution.");
  const values = { programme_id: programmeId || null, name, sequence };
  const query = id
    ? await supabase.from("academic_levels").update(values).eq("id", id).eq("school_id", school.id).select("id").maybeSingle()
    : await supabase.from("academic_levels").insert({ ...values, school_id: school.id }).select("id").maybeSingle();
  if (query.error) return failure(duplicate(query.error, "academic level"));
  if (!query.data) return failure("That academic level was not found in this institution.");
  return done(id ? "Academic level updated." : "Academic level created.");
}

export async function saveSubjectAction(_state: AcademicActionState, formData: FormData): Promise<AcademicActionState> {
  const id = readText(formData, "id");
  const departmentId = readText(formData, "departmentId");
  const programmeId = readText(formData, "programmeId");
  const levelId = readText(formData, "academicLevelId");
  const name = readText(formData, "name");
  const code = readText(formData, "code");
  const description = readText(formData, "description");
  const periodName = readText(formData, "academicPeriodName");
  const creditsText = readText(formData, "creditUnits");
  const credits = creditsText ? Number(creditsText) : null;
  if ((id && !uuidPattern.test(id)) || !validOptionalId(departmentId) || !validOptionalId(programmeId) || !validOptionalId(levelId) || name.length < 1 || name.length > 120 || code.length > 32 || description.length > 500 || periodName.length > 48 || (credits !== null && (!Number.isFinite(credits) || credits <= 0 || credits > 999.9 || Math.round(credits * 10) !== credits * 10))) return failure("Enter a course or subject name and valid optional details. Credit units must be positive and use at most one decimal place.");
  const { supabase, school } = await getCurrentSchool();
  for (const [table, relatedId, label] of [["departments", departmentId, "department"], ["academic_programmes", programmeId, "programme"], ["academic_levels", levelId, "academic level"]] as const) {
    if (relatedId && !(await verifyRelatedRecord(table, relatedId, school.id))) return failure(`Choose a ${label} belonging to this institution.`);
  }
  if (levelId) {
    const { data: level, error } = await supabase.from("academic_levels").select("programme_id").eq("id", levelId).eq("school_id", school.id).maybeSingle();
    if (error || !level) return failure("The selected academic level could not be verified.");
    if (level.programme_id && level.programme_id !== programmeId) return failure("Choose the programme associated with this academic level.");
  }
  const values = {
    school_id: school.id,
    department_id: departmentId || null,
    programme_id: programmeId || null,
    academic_level_id: levelId || null,
    academic_period_name: periodName || null,
    name,
    code: code || null,
    credit_units: credits,
    description: description || null,
  };
  const query = id
    ? await supabase.from("subjects").update(values).eq("id", id).eq("school_id", school.id).select("id").maybeSingle()
    : await supabase.from("subjects").insert(values).select("id").maybeSingle();
  if (query.error) return failure(duplicate(query.error, "course or subject"));
  if (!query.data) return failure("That course or subject was not found in this institution.");
  return done(id ? "Course or subject updated." : "Course or subject created.");
}

export async function setAcademicEntityActiveAction(_state: AcademicActionState, formData: FormData): Promise<AcademicActionState> {
  const id = readText(formData, "id");
  const entity = readText(formData, "entity") as Entity;
  const activeValue = readText(formData, "active");
  if (!uuidPattern.test(id) || !entities.includes(entity) || !["true", "false"].includes(activeValue)) return failure("Choose a valid academic record and status.");
  const { supabase, school } = await getCurrentSchool();
  const { data, error } = await supabase.from(entity).update({ is_active: activeValue === "true" }).eq("id", id).eq("school_id", school.id).select("id").maybeSingle();
  if (error) return failure("The academic record status could not be changed. Check whether active records depend on it.");
  if (!data) return failure("That academic record was not found in this institution.");
  return done(activeValue === "true" ? "Academic record reactivated." : "Academic record archived.");
}
