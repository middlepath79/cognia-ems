"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentSchool } from "@/lib/current-school";

export type StudentActionState = { error?: string; success?: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statuses = ["applicant", "admitted", "active", "deferred", "suspended", "withdrawn", "graduated"] as const;
const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const date = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value ? value : null;
const fail = (error: string): StudentActionState => ({ error });
function dbMessage(error: { code?: string }) {
  if (error.code === "23505") return "That student number, email, or application is already linked to a student.";
  if (error.code === "23503") return "One of the selected academic records does not belong to this institution or is no longer available.";
  return "The record could not be saved. Check the fields and try again.";
}
function refresh(id?: string) {
  revalidatePath("/admin/students");
  revalidatePath("/admin/admissions");
  if (id) revalidatePath(`/admin/students/${id}`);
}

export async function saveStudentAction(_state: StudentActionState, formData: FormData): Promise<StudentActionState> {
  const id = text(formData, "id");
  const firstName = text(formData, "firstName");
  const middleName = text(formData, "middleName");
  const surname = text(formData, "surname");
  const birth = text(formData, "dateOfBirth");
  const admissionDate = text(formData, "admissionDate");
  const email = text(formData, "email");
  const phone = text(formData, "phone");
  const address = text(formData, "address");
  const gender = text(formData, "gender");
  const status = text(formData, "status");
  if ((id && !uuid.test(id)) || firstName.length < 1 || firstName.length > 100 || surname.length < 1 || surname.length > 100 || middleName.length > 100 || (birth && !date(birth)) || !date(admissionDate) || email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || phone.length > 40 || address.length > 500 || gender.length > 32 || !statuses.includes(status as typeof statuses[number])) return fail("Review the required name, dates, status, and contact fields.");
  const { supabase, school } = await getCurrentSchool();
  let studentId = id;
  if (id) {
    const { data, error } = await supabase.from("students").update({ first_name: firstName, middle_name: middleName || null, surname, date_of_birth: birth || null, gender: gender || null, email: email || null, phone: phone || null, residential_address: address || null, admission_date: admissionDate, status }).eq("id", id).eq("school_id", school.id).select("id").maybeSingle();
    if (error) return fail(dbMessage(error));
    if (!data) return fail("Student not found in this institution.");
  } else {
    const { data: number, error: numberError } = await supabase.rpc("generate_student_number", { target_school_id: school.id });
    if (numberError || !number) return fail("A student number could not be generated. Please retry.");
    const { data, error } = await supabase.from("students").insert({ school_id: school.id, student_number: number, first_name: firstName, middle_name: middleName || null, surname, date_of_birth: birth || null, gender: gender || null, email: email || null, phone: phone || null, residential_address: address || null, admission_date: admissionDate, status }).select("id").single();
    if (error || !data) return fail(error ? dbMessage(error) : "Student could not be created.");
    studentId = data.id;
  }
  refresh(studentId);
  return { success: id ? "Student record updated." : "Student record created." };
}

export async function savePlacementAction(_state: StudentActionState, formData: FormData): Promise<StudentActionState> {
  const studentId = text(formData, "studentId");
  const structure = text(formData, "structureType");
  const classArmId = text(formData, "classArmId");
  const programmeId = text(formData, "programmeId");
  const levelId = text(formData, "academicLevelId");
  const sessionId = text(formData, "academicSessionId");
  const termId = text(formData, "academicTermId");
  const startsOn = text(formData, "startsOn");
  if (!uuid.test(studentId) || !uuid.test(sessionId) || !uuid.test(termId) || !date(startsOn) || !["basic", "programme"].includes(structure) || (structure === "basic" && (!uuid.test(classArmId) || programmeId || levelId)) || (structure === "programme" && (!uuid.test(programmeId) || !uuid.test(levelId) || classArmId))) return fail("Choose a valid student, academic session, period, and placement.");
  const { supabase, school } = await getCurrentSchool();
  const { error } = await supabase.rpc("save_student_enrolment", {
    target_school_id: school.id,
    target_student_id: studentId,
    target_structure_type: structure,
    target_class_arm_id: structure === "basic" ? classArmId : null,
    target_programme_id: structure === "programme" ? programmeId : null,
    target_academic_level_id: structure === "programme" ? levelId : null,
    target_academic_session_id: sessionId,
    target_academic_term_id: termId,
    target_starts_on: startsOn,
  });
  if (error) return fail(dbMessage(error));
  refresh(studentId);
  return { success: "Academic placement saved." };
}

export async function setStudentStatusAction(_state: StudentActionState, formData: FormData): Promise<StudentActionState> {
  const id = text(formData, "studentId"); const status = text(formData, "status");
  if (!uuid.test(id) || !statuses.includes(status as typeof statuses[number])) return fail("Choose a valid student status.");
  const { supabase, school } = await getCurrentSchool();
  const { data, error } = await supabase.from("students").update({ status }).eq("id", id).eq("school_id", school.id).select("id").maybeSingle();
  if (error) return fail(dbMessage(error)); if (!data) return fail("Student not found.");
  refresh(id); return { success: "Student status updated. The change is recorded in status history." };
}

export async function saveApplicationAction(_state: StudentActionState, formData: FormData): Promise<StudentActionState> {
  const firstName = text(formData, "firstName"); const middleName = text(formData, "middleName"); const surname = text(formData, "surname");
  const classArmId = text(formData, "classArmId"); const programmeId = text(formData, "programmeId"); const levelId = text(formData, "academicLevelId");
  const sessionId = text(formData, "academicSessionId"); const termId = text(formData, "academicTermId");
  const email = text(formData, "email"); const phone = text(formData, "phone"); const birth = text(formData, "dateOfBirth");
  const gender = text(formData, "gender"); const address = text(formData, "address");
  if (firstName.length < 1 || firstName.length > 100 || surname.length < 1 || surname.length > 100 || middleName.length > 100 || (birth && !date(birth)) || gender.length > 32 || email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || phone.length > 40 || address.length > 500 || (Boolean(classArmId) === Boolean(programmeId)) || (classArmId && !uuid.test(classArmId)) || (programmeId && (!uuid.test(programmeId) || !uuid.test(levelId))) || (sessionId && !uuid.test(sessionId)) || (termId && !uuid.test(termId)) || (termId && !sessionId)) return fail("Enter the applicant details and choose either a class or a programme with an academic level.");
  const { supabase, school } = await getCurrentSchool();
  const { data: ref, error: refError } = await supabase.rpc("generate_student_number", { target_school_id: school.id });
  if (refError || !ref) return fail("Could not generate an application reference.");
  const reference = `APP-${String(ref).replace(/^COG-/, "")}`;
  const { error } = await supabase.from("admission_applications").insert({ school_id: school.id, application_reference: reference, first_name: firstName, middle_name: middleName || null, surname, date_of_birth: birth || null, gender: gender || null, email: email || null, phone: phone || null, residential_address: address || null, applied_class_arm_id: classArmId || null, applied_programme_id: programmeId || null, applied_academic_level_id: levelId || null, academic_session_id: sessionId || null, academic_term_id: termId || null });
  if (error) return fail(dbMessage(error));
  revalidatePath("/admin/admissions"); return { success: `Application received. Reference: ${reference}` };
}

export async function decideApplicationAction(_state: StudentActionState, formData: FormData): Promise<StudentActionState> {
  const id = text(formData, "applicationId"); const status = text(formData, "status"); const notes = text(formData, "notes");
  if (!uuid.test(id) || !["reviewing", "accepted", "rejected", "waitlisted", "withdrawn"].includes(status) || notes.length > 1000) return fail("Choose a valid application decision and notes under 1000 characters.");
  const { supabase, school } = await getCurrentSchool();
  const { data, error } = await supabase.from("admission_applications").update({ application_status: status, decision_date: ["accepted", "rejected"].includes(status) ? new Date().toISOString().slice(0, 10) : null, decision_notes: notes || null }).eq("id", id).eq("school_id", school.id).neq("application_status", "converted").select("id").maybeSingle();
  if (error) return fail(dbMessage(error)); if (!data) return fail("Application not found or already converted.");
  revalidatePath("/admin/admissions"); return { success: "Application status updated." };
}

export async function convertApplicationAction(formData: FormData): Promise<void> {
  const id = text(formData, "applicationId"); if (!uuid.test(id)) return;
  const { supabase, school } = await getCurrentSchool();
  const { data, error } = await supabase.rpc("convert_admission_application", { target_school_id: school.id, target_application_id: id });
  if (error || !data) redirect("/admin/admissions?error=conversion");
  refresh(data); redirect(`/admin/students/${data}?created=admission`);
}

export async function saveGuardianAction(_state: StudentActionState, formData: FormData): Promise<StudentActionState> {
  const studentId = text(formData, "studentId"); const guardianId = text(formData, "guardianId");
  const firstName = text(formData, "firstName"); const surname = text(formData, "surname"); const relationship = text(formData, "relationship");
  const email = text(formData, "email"); const phone = text(formData, "phone");
  if (!uuid.test(studentId) || (guardianId && !uuid.test(guardianId)) || firstName.length < 1 || firstName.length > 100 || surname.length < 1 || surname.length > 100 || relationship.length < 1 || relationship.length > 48 || email.length > 254 || phone.length > 40) return fail("Enter guardian names, relationship, and valid contact details.");
  const { supabase, school } = await getCurrentSchool();
  let targetGuardian = guardianId;
  if (guardianId) {
    const { data, error } = await supabase.from("guardians").update({ first_name: firstName, surname, email: email || null, phone: phone || null }).eq("id", guardianId).eq("school_id", school.id).select("id").maybeSingle();
    if (error || !data) return fail("Guardian could not be updated.");
  } else {
    const { data, error } = await supabase.from("guardians").insert({ school_id: school.id, first_name: firstName, surname, email: email || null, phone: phone || null }).select("id").single();
    if (error || !data) return fail("Guardian could not be created."); targetGuardian = data.id;
  }
  const { error } = await supabase.from("student_guardians").upsert({ school_id: school.id, student_id: studentId, guardian_id: targetGuardian, relationship, is_emergency_contact: formData.get("emergency") === "on", is_active: true }, { onConflict: "school_id,student_id,guardian_id" });
  if (error) return fail(dbMessage(error)); refresh(studentId); return { success: "Guardian details saved." };
}

export async function addStudentDocumentAction(_state: StudentActionState, formData: FormData): Promise<StudentActionState> {
  const studentId = text(formData, "studentId"); const path = text(formData, "storagePath"); const fileName = text(formData, "fileName"); const contentType = text(formData, "contentType"); const bytes = Number(text(formData, "sizeBytes")); const type = text(formData, "documentType") || "other";
  if (!uuid.test(studentId) || path.length > 500 || fileName.length < 1 || fileName.length > 200 || !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(contentType) || !Number.isInteger(bytes) || bytes < 1 || bytes > 10485760 || type.length > 48) return fail("The document details are invalid. Files must be PDF or image files up to 10 MB.");
  const { supabase, school, userId } = await getCurrentSchool();
  if (!path.startsWith(`${school.id}/${studentId}/`)) return fail("The file path does not match this institution and student.");
  const { error } = await supabase.from("student_documents").insert({ school_id: school.id, student_id: studentId, storage_path: path, file_name: fileName, content_type: contentType, size_bytes: bytes, document_type: type, uploaded_by: userId });
  if (error) return fail(dbMessage(error)); refresh(studentId); return { success: "Document added to the student record." };
}

export async function saveStudentPhotoPathAction(_state: StudentActionState, formData: FormData): Promise<StudentActionState> {
  const studentId = text(formData, "studentId"); const path = text(formData, "storagePath");
  if (!uuid.test(studentId) || path.length > 500) return fail("Choose a valid student photograph.");
  const { supabase, school } = await getCurrentSchool();
  if (!path.startsWith(`${school.id}/${studentId}/`)) return fail("The photograph does not match this student.");
  const { data, error } = await supabase.from("students").update({ profile_photo_path: path }).eq("id", studentId).eq("school_id", school.id).select("id").maybeSingle();
  if (error) return fail(dbMessage(error)); if (!data) return fail("Student not found.");
  refresh(studentId); return { success: "Profile photograph updated." };
}
