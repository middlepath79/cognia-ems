"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentAttendanceSchool } from "@/lib/attendance-workspace";

export type AttendanceActionState = { error?: string; success?: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statuses = ["present", "absent", "late", "excused"] as const;
const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const date = (raw: string) => /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(Date.parse(`${raw}T00:00:00Z`)) && new Date(`${raw}T00:00:00Z`).toISOString().slice(0, 10) === raw ? raw : null;
const fail = (error: string): AttendanceActionState => ({ error });
function dbError(code?: string) {
  if (code === "23505") return "This attendance session or roster entry already exists.";
  if (code === "23503") return "A selected academic record does not belong to this institution.";
  if (code === "42501") return "You are not assigned to manage this attendance session.";
  return "The change could not be saved. Check the selected records and try again.";
}
function refresh() { revalidatePath("/admin/attendance"); revalidatePath("/admin/students"); }

export async function createAttendanceSessionAction(formData: FormData): Promise<void> {
  const model = value(formData, "model");
  const dateValue = date(value(formData, "attendanceDate"));
  const sessionId = value(formData, "academicSessionId"); const termId = value(formData, "academicTermId");
  const classId = value(formData, "classId"); const classArmId = value(formData, "classArmId");
  const subjectId = value(formData, "subjectId"); const lectureLabel = value(formData, "lectureLabel");
  const programmeId = value(formData, "programmeId"); const academicLevelId = value(formData, "academicLevelId");
  const sessionLabel = value(formData, "sessionLabel") || "Daily attendance";
  if (!(["class", "course"].includes(model)) || !dateValue || !uuid.test(sessionId) || !uuid.test(termId)
    || (model === "class" && (!uuid.test(classId) || (classArmId && !uuid.test(classArmId)) || subjectId || lectureLabel))
    || (model === "course" && (!uuid.test(subjectId) || !uuid.test(programmeId) || !uuid.test(academicLevelId) || classId || classArmId || lectureLabel.length < 1 || lectureLabel.length > 80))
    || sessionLabel.length > 80) redirect("/admin/attendance?view=take&error=invalid");
  const { supabase, school, userId } = await getCurrentAttendanceSchool();
  if (model === "course" && ["early_childhood", "basic", "secondary"].includes(school.institution_type)) redirect("/admin/attendance?view=take&error=model");
  if (model === "class" && ["college", "polytechnic", "monotechnic", "university", "postgraduate", "professional_research"].includes(school.institution_type)) redirect("/admin/attendance?view=take&error=model");
  if (model === "course") {
    const [programme, level, subject] = await Promise.all([
      supabase.from("academic_programmes").select("id").eq("id",programmeId).eq("school_id",school.id).eq("is_active",true).maybeSingle(),
      supabase.from("academic_levels").select("id").eq("id",academicLevelId).eq("school_id",school.id).eq("programme_id",programmeId).eq("is_active",true).maybeSingle(),
      supabase.from("subjects").select("id,programme_id,academic_level_id").eq("id",subjectId).eq("school_id",school.id).eq("is_active",true).maybeSingle(),
    ]);
    if (!programme.data || !level.data || !subject.data || (subject.data.programme_id && subject.data.programme_id !== programmeId) || (subject.data.academic_level_id && subject.data.academic_level_id !== academicLevelId)) redirect("/admin/attendance?view=take&error=context");
  }
  const query = supabase.from("attendance_sessions").select("id").eq("school_id", school.id).eq("attendance_model", model).eq("attendance_date", dateValue).eq("academic_session_id", sessionId).eq("academic_term_id", termId);
  const matched = model === "class"
    ? classArmId ? await query.eq("class_id", classId).eq("class_arm_id", classArmId).maybeSingle() : await query.eq("class_id", classId).is("class_arm_id", null).maybeSingle()
    : await query.eq("subject_id", subjectId).eq("programme_id",programmeId).eq("academic_level_id",academicLevelId).eq("lecture_label", lectureLabel).maybeSingle();
  if (matched.data?.id) redirect(`/admin/attendance?view=take&session=${matched.data.id}`);
  const { data, error } = await supabase.from("attendance_sessions").insert({
    school_id: school.id, attendance_model: model, attendance_date: dateValue, academic_session_id: sessionId, academic_term_id: termId,
    class_id: model === "class" ? classId : null, class_arm_id: model === "class" ? classArmId || null : null,
    subject_id: model === "course" ? subjectId : null, lecture_label: model === "course" ? lectureLabel : null,
    programme_id: model === "course" ? programmeId : null, academic_level_id: model === "course" ? academicLevelId : null,
    session_label: sessionLabel, notes: value(formData, "notes") || null, created_by: userId, updated_by: userId,
  }).select("id").maybeSingle();
  if (error) {
    if (error.code === "23505") {
      const retry = model === "class"
        ? classArmId ? await supabase.from("attendance_sessions").select("id").eq("school_id",school.id).eq("attendance_date",dateValue).eq("academic_session_id",sessionId).eq("academic_term_id",termId).eq("class_id",classId).eq("class_arm_id",classArmId).maybeSingle() : await supabase.from("attendance_sessions").select("id").eq("school_id",school.id).eq("attendance_date",dateValue).eq("academic_session_id",sessionId).eq("academic_term_id",termId).eq("class_id",classId).is("class_arm_id",null).maybeSingle()
        : await supabase.from("attendance_sessions").select("id").eq("school_id",school.id).eq("attendance_date",dateValue).eq("academic_session_id",sessionId).eq("academic_term_id",termId).eq("subject_id",subjectId).eq("programme_id",programmeId).eq("academic_level_id",academicLevelId).eq("lecture_label",lectureLabel).maybeSingle();
      if (retry.data?.id) redirect(`/admin/attendance?view=take&session=${retry.data.id}`);
    }
    console.error("Attendance session creation failed", error.message);
    redirect(`/admin/attendance?view=take&error=${error.code === "42501" ? "permission" : "save"}`);
  }
  if (!data) redirect("/admin/attendance?view=take&error=save");
  refresh(); redirect(`/admin/attendance?view=take&session=${data.id}`);
}

export async function saveAttendanceBatchAction(_state: AttendanceActionState, formData: FormData): Promise<AttendanceActionState> {
  const sessionId = value(formData, "sessionId"); const payload = value(formData, "records");
  if (!uuid.test(sessionId) || payload.length > 500_000) return fail("The attendance form is invalid.");
  let parsed: unknown;
  try { parsed = JSON.parse(payload); } catch { return fail("Attendance data could not be read. Refresh and try again."); }
  if (!Array.isArray(parsed) || parsed.length > 1000) return fail("Attendance data could not be validated.");
  const rows = parsed as { studentId?: unknown; status?: unknown; remarks?: unknown }[];
  if (rows.some((row) => typeof row.studentId !== "string" || !uuid.test(row.studentId) || !statuses.includes(row.status as typeof statuses[number]) || typeof row.remarks !== "string" || row.remarks.length > 500)) return fail("Select a status for each student and keep remarks under 500 characters.");
  const studentIds = rows.map((row) => row.studentId as string);
  if (new Set(studentIds).size !== studentIds.length) return fail("The attendance list contains a duplicate student.");
  const { supabase, school, userId } = await getCurrentAttendanceSchool();
  const { data: roster, error: rosterError } = await supabase.rpc("get_attendance_roster", { target_school_id: school.id, target_session_id: sessionId });
  if (rosterError || !roster) return fail("You cannot record attendance for this session.");
  const eligible = new Set(roster.map((student: { student_id: string }) => student.student_id));
  if (studentIds.length !== eligible.size || studentIds.some((id) => !eligible.has(id))) return fail("The eligible student list changed. Refresh before saving attendance.");
  const records = rows.map((row) => ({ school_id: school.id, attendance_session_id: sessionId, student_id: row.studentId as string, status: row.status as typeof statuses[number], remarks: (row.remarks as string).trim() || null, recorded_by: userId }));
  if (records.length) {
    const { error } = await supabase.from("attendance_records").upsert(records, { onConflict: "school_id,attendance_session_id,student_id" });
    if (error) { console.error("Attendance save failed", error.message); return fail(dbError(error.code)); }
  }
  refresh(); return { success: `Attendance saved for ${records.length} students.` };
}

export async function saveCourseEnrolmentsAction(_state: AttendanceActionState, formData: FormData): Promise<AttendanceActionState> {
  let students: unknown;
  try { students = JSON.parse(value(formData, "studentIds")); } catch { return fail("Select at least one student for the course roster."); }
  const subjectId = value(formData, "subjectId"); const programmeId = value(formData,"programmeId"); const academicLevelId = value(formData,"academicLevelId"); const sessionId = value(formData, "academicSessionId"); const termId = value(formData, "academicTermId"); const startsOn = date(value(formData, "startsOn"));
  if (!Array.isArray(students) || students.length < 1 || students.length > 1000 || students.some((id) => typeof id !== "string" || !uuid.test(id)) || !uuid.test(subjectId) || !uuid.test(programmeId) || !uuid.test(academicLevelId) || !uuid.test(sessionId) || !uuid.test(termId) || !startsOn) return fail("Choose a programme, academic level, course, session, period, date, and one or more students.");
  if (new Set(students).size !== students.length) return fail("The selected roster contains duplicate students.");
  const { supabase, school, userId, role } = await getCurrentAttendanceSchool();
  if (role !== "school_admin") return fail("Only an institution administrator can maintain course rosters.");
  const [programme, level, subject, placements, activeStudents] = await Promise.all([
    supabase.from("academic_programmes").select("id").eq("id",programmeId).eq("school_id",school.id).eq("is_active",true).maybeSingle(),
    supabase.from("academic_levels").select("id").eq("id",academicLevelId).eq("school_id",school.id).eq("programme_id",programmeId).eq("is_active",true).maybeSingle(),
    supabase.from("subjects").select("id,programme_id,academic_level_id").eq("id",subjectId).eq("school_id",school.id).eq("is_active",true).maybeSingle(),
    supabase.from("student_enrolments").select("student_id").eq("school_id",school.id).eq("structure_type","programme").eq("programme_id",programmeId).eq("academic_level_id",academicLevelId).eq("academic_session_id",sessionId).eq("academic_term_id",termId).eq("is_current",true).lte("starts_on",startsOn).or(`ends_on.is.null,ends_on.gte.${startsOn}`).in("student_id",students as string[]),
    supabase.from("students").select("id").eq("school_id",school.id).eq("status","active").in("id",students as string[]),
  ]);
  if (!programme.data || !level.data || !subject.data || (subject.data.programme_id && subject.data.programme_id !== programmeId) || (subject.data.academic_level_id && subject.data.academic_level_id !== academicLevelId)) return fail("The selected course, programme, and level must be active and compatible in this institution.");
  if (activeStudents.error || (activeStudents.data?.length ?? 0) !== students.length) return fail("Every selected student must be active in this institution.");
  if (placements.error || (placements.data?.length ?? 0) !== students.length) return fail("Every selected student must have a current placement in this programme and level for the chosen session and period.");
  const rows = (students as string[]).map((studentId) => ({ school_id:school.id,student_id:studentId,subject_id:subjectId,programme_id:programmeId,academic_level_id:academicLevelId,academic_session_id:sessionId,academic_term_id:termId,starts_on:startsOn,ends_on:null,is_active:true,created_by:userId }));
  const { error } = await supabase.from("course_enrolments").upsert(rows,{onConflict:"school_id,student_id,subject_id,academic_session_id,academic_term_id"});
  if (error) return fail(dbError(error.code)); refresh(); return { success:`${rows.length} course enrolment${rows.length===1?"":"s"} saved.` };
}

export async function deactivateCourseEnrolmentAction(_state: AttendanceActionState, formData: FormData): Promise<AttendanceActionState> {
  const id = value(formData,"id"); if (!uuid.test(id)) return fail("Choose a valid course enrolment.");
  const { supabase, school, role } = await getCurrentAttendanceSchool(); if (role !== "school_admin") return fail("Administrator access is required.");
  const { data,error } = await supabase.from("course_enrolments").update({is_active:false,ends_on:new Date().toISOString().slice(0,10)}).eq("id",id).eq("school_id",school.id).select("id").maybeSingle();
  if (error || !data) return fail(dbError(error?.code)); refresh(); return { success:"Course enrolment ended. Attendance history remains available." };
}

export async function saveTeachingAssignmentAction(_state: AttendanceActionState, formData: FormData): Promise<AttendanceActionState> {
  const teacherId = value(formData,"teacherUserId"); const model = value(formData,"assignmentType"); const sessionId = value(formData,"academicSessionId");
  const classId = value(formData,"classId"); const classArmId = value(formData,"classArmId"); const subjectId = value(formData,"subjectId");
  if (!uuid.test(teacherId) || !uuid.test(sessionId) || !["class","course"].includes(model) || (model==="class" && (!uuid.test(classId)||subjectId)) || (model==="course" && (!uuid.test(subjectId)||classId||classArmId))) return fail("Choose a teacher, academic session, and one class or course assignment.");
  const { supabase, school, userId, role } = await getCurrentAttendanceSchool(); if (role !== "school_admin") return fail("Administrator access is required.");
  const { data: membership } = await supabase.from("school_memberships").select("user_id").eq("school_id",school.id).eq("user_id",teacherId).eq("role","teacher").eq("status","active").maybeSingle();
  if (!membership) return fail("Choose an active teacher or lecturer belonging to this institution.");
  const { error } = await supabase.from("attendance_staff_assignments").insert({school_id:school.id,teacher_user_id:teacherId,assignment_type:model,academic_session_id:sessionId,class_id:model==="class"?classId:null,class_arm_id:model==="class"?classArmId||null:null,subject_id:model==="course"?subjectId:null,assigned_by:userId});
  if (error) return fail(dbError(error.code)); refresh(); return { success:"Teaching assignment created." };
}

export async function setTeachingAssignmentActiveAction(_state: AttendanceActionState, formData: FormData): Promise<AttendanceActionState> {
  const id=value(formData,"id");const active=value(formData,"active");if(!uuid.test(id)||!["true","false"].includes(active))return fail("Choose a valid teaching assignment.");
  const {supabase,school,role}=await getCurrentAttendanceSchool();if(role!=="school_admin")return fail("Administrator access is required.");
  const {data,error}=await supabase.from("attendance_staff_assignments").update({is_active:active==="true"}).eq("id",id).eq("school_id",school.id).select("id").maybeSingle();
  if(error||!data)return fail(dbError(error?.code));refresh();return {success:active==="true"?"Teaching assignment activated.":"Teaching assignment deactivated."};
}
