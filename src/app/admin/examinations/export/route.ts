import { NextRequest } from "next/server";
import { getCurrentAttendanceSchool } from "@/lib/attendance-workspace";

const cell = (value: unknown) => {
  const raw = String(value ?? "");
  const safe = /^[=+@-]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
};
type Roster = { student_id: string; student_number: string; first_name: string; middle_name: string | null; surname: string; score: number | null; remarks: string | null; result_status: string | null };

export async function GET(request: NextRequest) {
  const { supabase, school } = await getCurrentAttendanceSchool();
  const params = request.nextUrl.searchParams;
  let query = supabase.from("examinations").select("id,name,assessment_model,maximum_marks,status,academic_session_id,academic_term_id,class_arm_id,programme_id,academic_level_id,subject_id").eq("school_id", school.id).in("status", ["published", "closed", "archived"]);
  const session = params.get("sessionId"); const term = params.get("termId");
  if (session) query = query.eq("academic_session_id", session);
  if (term) query = query.eq("academic_term_id", term);
  const { data: exams, error } = await query.order("name").limit(300);
  if (error) return new Response("Examination report unavailable", { status: 403 });
  const lines = [["Examination", "Academic model", "Student ID", "Student", "Raw examination mark", "Raw maximum", "Mark status", "CA contribution", "Examination contribution", "Final total", "Grade", "Missing component status", "Final result status", "Remarks"].map(cell).join(",")];

  for (const exam of exams ?? []) {
    const { data: roster, error: rosterError } = await supabase.rpc("get_examination_roster", { target_examination: exam.id });
    if (rosterError) continue;
    const students = (roster ?? []) as Roster[];
    let resultQuery = supabase.from("academic_period_results").select("student_id,ca_contribution,examination_contribution,final_total,grade,missing_components,status").eq("school_id", school.id).eq("assessment_model", exam.assessment_model).eq("subject_id", exam.subject_id).eq("academic_session_id", exam.academic_session_id).eq("academic_term_id", exam.academic_term_id);
    resultQuery = exam.assessment_model === "class" ? resultQuery.eq("class_arm_id", exam.class_arm_id) : resultQuery.eq("programme_id", exam.programme_id).eq("academic_level_id", exam.academic_level_id);
    const { data: finalResults } = students.length ? await resultQuery.in("student_id", students.map(row => row.student_id)) : { data: [] };
    const resultMap = new Map((finalResults ?? []).map(row => [row.student_id, row]));
    let marked = 0; let missingRaw = 0; let completeFinal = 0;
    for (const student of students) {
      const final = resultMap.get(student.student_id);
      if (student.score === null) missingRaw++; else marked++;
      if (final?.status === "published") completeFinal++;
      const missing = Array.isArray(final?.missing_components) && final.missing_components.length ? final.missing_components.map((item: { component?: string }) => item.component ?? "missing").join("; ") : final ? "Complete" : "Not calculated";
      lines.push([exam.name, exam.assessment_model, student.student_number, `${student.first_name} ${student.middle_name ?? ""} ${student.surname}`.trim(), student.score ?? "", exam.maximum_marks, student.result_status ?? "missing", final?.ca_contribution ?? "", final?.examination_contribution ?? "", final?.final_total ?? "", final?.grade ?? "", missing, final?.status ?? "not calculated", student.remarks ?? ""].map(cell).join(","));
    }
    lines.push([`SUMMARY · ${exam.name}`, exam.assessment_model, "", "Eligible students", students.length, exam.maximum_marks, "", "", "", "", "", "", "", ""].map(cell).join(","));
    lines.push([`SUMMARY · ${exam.name}`, exam.assessment_model, "", "Raw marks entered", marked, exam.maximum_marks, "", "", "", "", "", "", "", ""].map(cell).join(","));
    lines.push([`SUMMARY · ${exam.name}`, exam.assessment_model, "", "Missing raw marks", missingRaw, exam.maximum_marks, "", "", "", "", "", "", "", ""].map(cell).join(","));
    lines.push([`SUMMARY · ${exam.name}`, exam.assessment_model, "", "Published final results", completeFinal, exam.maximum_marks, "", "", "", "", "", "", "", ""].map(cell).join(","));
    lines.push([`SUMMARY · ${exam.name}`, exam.assessment_model, "", "Final publication rate", students.length ? `${Math.round(completeFinal / students.length * 100)}%` : "0%", exam.maximum_marks, "", "", "", "", "", "", "", ""].map(cell).join(","));
  }
  return new Response(`\uFEFF${lines.join("\r\n")}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=cognia-examination-results.csv", "Cache-Control": "no-store" } });
}
