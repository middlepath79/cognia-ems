"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAttendanceSchool } from "@/lib/attendance-workspace";

export type RecordActionState = { error?: string; success?: string; transcriptId?: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const value = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const refresh = () => { revalidatePath("/admin/academic-records"); revalidatePath("/portal"); };

export async function saveGradingConfiguration(_state: RecordActionState, form: FormData): Promise<RecordActionState> {
  const { supabase, school, role } = await getCurrentAttendanceSchool();
  if (role !== "school_admin") return { error: "Institution administrator access is required." };
  let gradeBands: unknown; let standingRules: unknown;
  try { gradeBands = JSON.parse(value(form, "gradeBands")); standingRules = JSON.parse(value(form, "standingRules") || "[]"); }
  catch { return { error: "Grade bands and standing rules must be valid JSON arrays." }; }
  if (!Array.isArray(gradeBands) || !Array.isArray(standingRules)) return { error: "Grade bands and standing rules must be JSON arrays." };
  const overallMaximum = Number(value(form, "overallMaximum"));
  const caMaximum = Number(value(form, "caMaximum"));
  const examinationMaximum = Number(value(form, "examinationMaximum"));
  const gpaEnabled = form.get("gpaEnabled") === "on";
  const gpaScaleMaximum = value(form, "gpaScaleMaximum");
  if (![overallMaximum, caMaximum, examinationMaximum].every(Number.isFinite) || overallMaximum <= 0 || caMaximum < 0 || examinationMaximum < 0 || caMaximum + examinationMaximum !== overallMaximum) return { error: "CA and examination maxima must add up exactly to the institution grading maximum." };
  if (gpaEnabled && (!Number.isFinite(Number(gpaScaleMaximum)) || Number(gpaScaleMaximum) <= 0)) return { error: "Set the grade-point scale maximum when GPA is enabled." };
  if (gpaEnabled && (!(["credit_weighted", "course_average"].includes(value(form, "gpaMethod"))) || !(["latest", "highest", "all_attempts", "exclude_repeats"].includes(value(form, "repeatPolicy"))) || !(["include", "exclude"].includes(value(form, "transferCreditPolicy"))))) return { error: "Choose a GPA method, course-repeat policy and transfer-credit policy before enabling GPA." };
  const configuration = {
    overallMaximum, caMaximum, examinationMaximum, gradeBands, gpaEnabled,
    gpaScaleMaximum: gpaEnabled ? Number(gpaScaleMaximum) : null,
    gpaMethod: value(form, "gpaMethod"),
    repeatPolicy: value(form, "repeatPolicy"),
    transferCreditPolicy: value(form, "transferCreditPolicy"),
    standingRules,
  };
  const { error } = await supabase.rpc("save_academic_grading_configuration", { configuration, target_school_id: school.id });
  if (error) return { error: error.message.includes("weights") ? error.message : "The configuration was not saved. Check grade bands and GPA settings." };
  refresh(); return { success: "A new grading configuration version is active. Historical results retain their saved version." };
}

export async function recalculatePeriodResult(_state: RecordActionState, form: FormData): Promise<RecordActionState> {
  const { supabase, school, role } = await getCurrentAttendanceSchool();
  if (role !== "school_admin") return { error: "Institution administrator access is required." };
  const student = value(form, "student"); const model = value(form, "model"); const subject = value(form, "subject"); const session = value(form, "session"); const term = value(form, "term");
  const classArm = value(form, "classArm"); const programme = value(form, "programme"); const level = value(form, "level"); const reason = value(form, "reason");
  if (![student, subject, session, term].every(item => uuid.test(item)) || !["class", "course"].includes(model) || (model === "class" ? !uuid.test(classArm) || programme || level : !uuid.test(programme) || !uuid.test(level) || classArm)) return { error: "Select a valid student, academic period and matching placement." };
  const { data, error } = await supabase.rpc("recalculate_academic_period_result", {
    target_student: student, target_model: model, target_subject: subject, target_session: session, target_term: term,
    target_class_arm: classArm || null, target_programme: programme || null, target_level: level || null,
    correction_reason: reason || null, target_school_id: school.id,
  });
  if (error) return { error: error.message.includes("reason") ? error.message : error.message.includes("Configure") ? error.message : "Result calculation failed. Verify that all required marks are published and weights match institution settings." };
  refresh(); return { success: data?.missing_components?.length ? `Result saved as incomplete: ${data.missing_components.length} required component(s) are missing.` : "Final result recalculated and saved as a draft for review." };
}

export async function transitionPeriodResult(_state: RecordActionState, form: FormData): Promise<RecordActionState> {
  const { supabase, school, role } = await getCurrentAttendanceSchool();
  const id = value(form, "id"); const status = value(form, "status");
  if (role !== "school_admin") return { error: "Institution administrator access is required." };
  if (!uuid.test(id) || !["submitted", "under_review", "approved", "published"].includes(status)) return { error: "Choose a valid result workflow step." };
  const { error } = await supabase.rpc("transition_academic_period_result", { target_result: id, target_status: status, reason: value(form, "reason") || null, target_school_id: school.id });
  if (error) return { error: error.message.includes("Incomplete") ? "Incomplete results cannot move through approval." : "That approval transition is not allowed." };
  refresh(); return { success: `Final result moved to ${status.replaceAll("_", " ")}.` };
}

export async function recalculateStudentGpa(_state: RecordActionState, form: FormData): Promise<RecordActionState> {
  const { supabase, school, role } = await getCurrentAttendanceSchool();
  const student = value(form, "student"); const session = value(form, "session"); const term = value(form, "term");
  if (role !== "school_admin") return { error: "Institution administrator access is required." };
  if (![student, session, term].every(item => uuid.test(item))) return { error: "Select a student and academic period." };
  const { error } = await supabase.rpc("recalculate_student_gpa", { target_student: student, target_session: session, target_term: term, target_school_id: school.id });
  if (error) return { error: error.message.includes("configured GPA") ? error.message : "GPA calculation failed. Confirm published results and credit-unit settings." };
  refresh(); return { success: "GPA and cumulative GPA were recalculated from eligible published course results." };
}

export async function issueTranscript(_state: RecordActionState, form: FormData): Promise<RecordActionState> {
  const { supabase, school, role } = await getCurrentAttendanceSchool();
  const student = value(form, "student"); const session = value(form, "session"); const term = value(form, "term");
  if (role !== "school_admin") return { error: "Institution administrator access is required." };
  const correctionOf = value(form, "correctionOf");
  if (!uuid.test(student) || (session && !uuid.test(session)) || (term && !uuid.test(term)) || (term && !session) || (correctionOf && !uuid.test(correctionOf))) return { error: "Choose a valid student and optional academic period." };
  const { data, error } = await supabase.rpc("issue_student_transcript", { target_student: student, target_session: session || null, target_term: term || null, target_school_id: school.id, target_correction_of: correctionOf || null });
  if (error || !data) return { error: "An official transcript could not be issued. Only published final results are included." };
  refresh(); return { success: `Transcript ${data.transcript_reference} issued.`, transcriptId: data.id };
}

export async function voidTranscript(_state: RecordActionState, form: FormData): Promise<RecordActionState> {
  const { supabase, school, role } = await getCurrentAttendanceSchool();
  const transcript = value(form, "transcript"); const reason = value(form, "reason");
  if (role !== "school_admin") return { error: "Institution administrator access is required." };
  if (!uuid.test(transcript) || reason.length < 8 || reason.length > 1000) return { error: "Enter a traceable reason of at least 8 characters." };
  const { error } = await supabase.rpc("void_student_transcript", { target_transcript: transcript, reason, target_school_id: school.id });
  if (error) return { error: "This transcript could not be voided. It may already be void or outside this institution." };
  refresh(); return { success: "Transcript voided. Issue details and snapshot remain retained." };
}

export async function createCreditAdjustment(_state: RecordActionState, form: FormData): Promise<RecordActionState> {
  const { supabase, school, userId, role } = await getCurrentAttendanceSchool();
  const student = value(form, "student"); const subject = value(form, "subject"); const session = value(form, "session"); const term = value(form, "term");
  const type = value(form, "adjustmentType"); const credits = Number(value(form, "credits")); const gradePointRaw = value(form, "gradePoint"); const reason = value(form, "reason");
  if (role !== "school_admin") return { error: "Institution administrator access is required." };
  if (![student, session, term].every(item => uuid.test(item)) || (subject && !uuid.test(subject)) || !["transfer_credit", "exemption"].includes(type) || !Number.isFinite(credits) || credits <= 0 || reason.length < 8 || reason.length > 1000 || (gradePointRaw && (!Number.isFinite(Number(gradePointRaw)) || Number(gradePointRaw) < 0))) return { error: "Check the student, academic period, credit units and reason." };
  const { error } = await supabase.from("academic_credit_adjustments").insert({ school_id: school.id, student_id: student, adjustment_type: type, subject_id: subject || null, academic_session_id: session, academic_term_id: term, credit_units: credits, grade: value(form, "grade") || null, grade_point: gradePointRaw ? Number(gradePointRaw) : null, source_institution: value(form, "sourceInstitution") || null, reason, created_by: userId, status: "pending" });
  if (error) return { error: "The credit adjustment could not be recorded." };
  refresh(); return { success: "Credit adjustment recorded for review." };
}

export async function decideCreditAdjustment(_state: RecordActionState, form: FormData): Promise<RecordActionState> {
  const { supabase, school, role } = await getCurrentAttendanceSchool();
  const id = value(form, "id"); const status = value(form, "status");
  if (role !== "school_admin") return { error: "Institution administrator access is required." };
  if (!uuid.test(id) || !["approved", "rejected"].includes(status)) return { error: "Choose a valid credit adjustment decision." };
  const { data, error } = await supabase.from("academic_credit_adjustments").update({ status }).eq("id", id).eq("school_id", school.id).eq("status", "pending").select("id").maybeSingle();
  if (error || !data) return { error: "This credit adjustment could not be decided." };
  refresh(); return { success: `Credit adjustment ${status}.` };
}

export async function createAcademicProgress(_state: RecordActionState, form: FormData): Promise<RecordActionState> {
  const { supabase, school, userId, role } = await getCurrentAttendanceSchool();
  const student = value(form, "student"); const model = value(form, "model"); const session = value(form, "session"); const term = value(form, "term");
  const arm = value(form, "classArm"); const programme = value(form, "programme"); const level = value(form, "level"); const status = value(form, "progressionStatus"); const reason = value(form, "reason");
  if (role !== "school_admin") return { error: "Institution administrator access is required." };
  if (![student, session, term].every(item => uuid.test(item)) || !["class", "course"].includes(model) || (model === "class" ? !uuid.test(arm) || programme || level : !uuid.test(programme) || !uuid.test(level) || arm) || !["progressing", "completed", "deferred", "suspended", "withdrawn", "academic_warning"].includes(status) || reason.length < 8 || reason.length > 1000) return { error: "Check the student placement, period, progression outcome and reason." };
  const publish = form.get("publish") === "on";
  const { error } = await supabase.from("academic_progress_records").insert({ school_id: school.id, student_id: student, academic_session_id: session, academic_term_id: term, structure_type: model === "class" ? "basic" : "programme", class_arm_id: model === "class" ? arm : null, programme_id: model === "course" ? programme : null, academic_level_id: model === "course" ? level : null, progression_status: status, decision_reason: reason, is_published: publish, created_by: userId, decided_by: publish ? userId : null });
  if (error) return { error: "The progression record could not be saved." };
  refresh(); return { success: publish ? "Progression decision published to the student." : "Progression decision saved as a private draft." };
}
