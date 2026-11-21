import Link from "next/link";import PageHeading from "@/components/page-heading";import {getCurrentAttendanceSchool} from "@/lib/attendance-workspace";import ExaminationDetail from "./detail";
export default async function ExaminationPage({params}:{params:Promise<{id:string}>}){
 const{id}=await params;const{school,role,supabase}=await getCurrentAttendanceSchool();const{data:exam,error}=await supabase.from("examinations").select("*").eq("id",id).eq("school_id",school.id).maybeSingle();
 if(error||!exam)return <><Link href="/admin/examinations" className="text-sm font-semibold text-indigo-700">← Examinations</Link><div className="card mt-4 p-6 text-sm text-rose-700">Examination unavailable. Check your access or confirm that Phase 4D is deployed.</div></>;
 const[rosterResult,subjectResult,historyResult]=await Promise.all([
  supabase.rpc("get_examination_roster",{target_examination:id}),
  supabase.from("subjects").select("name,code").eq("id",exam.subject_id).eq("school_id",school.id).maybeSingle(),
  supabase.from("examination_result_history").select("student_id,previous_score,new_score,previous_status,new_status,correction_reason,changed_by,changed_at").eq("school_id",school.id).eq("examination_id",id).order("changed_at",{ascending:false}).limit(300),
 ]);
 const roster=(rosterResult.data??[]) as {student_id:string;student_number:string;first_name:string;middle_name:string|null;surname:string;score:number|null;remarks:string|null;result_status:string|null}[];
 return <><Link href="/admin/examinations" className="mb-4 inline-block text-sm font-semibold text-indigo-700">← Examinations</Link><PageHeading title={exam.name} description={`${exam.examination_type} · ${subjectResult.data?.name??"Subject"} · ${exam.examination_date??"Date not set"} · Maximum ${exam.maximum_marks}`}/><ExaminationDetail exam={exam} role={role} roster={roster} rosterError={Boolean(rosterResult.error)} history={(historyResult.data??[]) as {student_id:string;previous_score:number|null;new_score:number|null;previous_status:string|null;new_status:string;correction_reason:string|null;changed_by:string|null;changed_at:string}[]}/></>;
}
