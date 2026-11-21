import { NextRequest, NextResponse } from "next/server";
import { getCurrentAttendanceSchool } from "@/lib/attendance-workspace";

function csvCell(input: unknown) {
  let value=String(input??"");
  if(/^[=+@-]/.test(value))value=`'${value}`;
  return `"${value.replace(/"/g,'""')}"`;
}
function validDate(value:string|null) { return value&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(`${value}T00:00:00Z`))?value:null; }

export async function GET(request:NextRequest) {
  const {supabase,school}=await getCurrentAttendanceSchool();
  const from=validDate(request.nextUrl.searchParams.get("from"));
  const to=validDate(request.nextUrl.searchParams.get("to"));
  if(!from||!to||from>to||Date.parse(`${to}T00:00:00Z`)-Date.parse(`${from}T00:00:00Z`)>366*86400000) return NextResponse.json({error:"Choose a valid date range up to one year."},{status:400});
  const [sessionsResult,classesResult,armsResult,subjectsResult,termsResult,academicSessionsResult]=await Promise.all([
    supabase.from("attendance_sessions").select("id,attendance_model,attendance_date,academic_session_id,academic_term_id,class_id,class_arm_id,subject_id,lecture_label,session_label").eq("school_id",school.id).gte("attendance_date",from).lte("attendance_date",to).order("attendance_date").limit(500),
    supabase.from("school_classes").select("id,name").eq("school_id",school.id),
    supabase.from("class_arms").select("id,name,class_id").eq("school_id",school.id),
    supabase.from("subjects").select("id,name,code").eq("school_id",school.id),
    supabase.from("academic_terms").select("id,name").eq("school_id",school.id),
    supabase.from("academic_sessions").select("id,name").eq("school_id",school.id),
  ]);
  if(sessionsResult.error||classesResult.error||armsResult.error||subjectsResult.error||termsResult.error||academicSessionsResult.error)return NextResponse.json({error:"Attendance report could not be loaded."},{status:500});
  const sessions=sessionsResult.data??[];
  const [rosters,recordsResult]=await Promise.all([
    Promise.all(sessions.map(async(session)=>{const response=await supabase.rpc("get_attendance_roster",{target_school_id:school.id,target_session_id:session.id});return {sessionId:session.id,rows:response.error?[]:response.data??[]};})),
    sessions.length?supabase.from("attendance_records").select("attendance_session_id,student_id,status,remarks,recorded_at").eq("school_id",school.id).in("attendance_session_id",sessions.map((item)=>item.id)):Promise.resolve({data:[],error:null}),
  ]);
  if(recordsResult.error)return NextResponse.json({error:"Attendance records could not be loaded."},{status:500});
  const recordMap=new Map((recordsResult.data??[]).map((record)=>[`${record.attendance_session_id}:${record.student_id}`,record]));
  const rows=["Attendance date,Institution,Model,Class or course,Session,Academic session,Academic period,Student ID,Student name,Status,Remark,Recorded at"];
  for(const session of sessions){
    const arm=armsResult.data?.find((item)=>item.id===session.class_arm_id);
    const label=session.attendance_model==="class"?`${classesResult.data?.find((item)=>item.id===session.class_id)?.name??"Class"}${arm?` · ${arm.name}`:" · all arms"}`:`${subjectsResult.data?.find((item)=>item.id===session.subject_id)?.code?`${subjectsResult.data?.find((item)=>item.id===session.subject_id)?.code} · `:""}${subjectsResult.data?.find((item)=>item.id===session.subject_id)?.name??"Course"}`;
    const academicSession=academicSessionsResult.data?.find((item)=>item.id===session.academic_session_id)?.name??"";
    const period=termsResult.data?.find((item)=>item.id===session.academic_term_id)?.name??"";
    for(const student of rosters.find((item)=>item.sessionId===session.id)?.rows??[]){
      const record=recordMap.get(`${session.id}:${student.student_id}`);
      const studentName=`${student.first_name} ${student.middle_name?`${student.middle_name} `:""}${student.surname}`;
      rows.push([session.attendance_date,school.name,session.attendance_model,label,session.lecture_label??session.session_label,academicSession,period,student.student_number,studentName,record?.status??"unmarked",record?.remarks??"",record?.recorded_at??""].map(csvCell).join(","));
    }
  }
  return new NextResponse(`\uFEFF${rows.join("\r\n")}`,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="cognia-attendance-${from}-to-${to}.csv"`,"Cache-Control":"no-store"}});
}
