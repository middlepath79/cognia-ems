import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeading from "@/components/page-heading";
import { getCurrentAttendanceSchool } from "@/lib/attendance-workspace";
import AssessmentDetailManager from "./detail-manager";

export default async function AssessmentDetailPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const {supabase,school,role,userId}=await getCurrentAttendanceSchool();
 const {data:assessment,error}=await supabase.from("assessments").select("*").eq("id",id).eq("school_id",school.id).maybeSingle();if(error||!assessment)notFound();
 const [rosterResult,submissionsResult,resourcesResult,subjectResult]=await Promise.all([
  supabase.rpc("get_assessment_roster",{target_assessment:id}),
  supabase.from("coursework_submissions").select("id,student_id,storage_path,original_filename,content_type,file_size,submission_status,submitted_at").eq("school_id",school.id).eq("assessment_id",id).order("submitted_at"),
  supabase.from("assessment_resources").select("id,title,storage_path,content_type,file_size,created_at").eq("school_id",school.id).eq("assessment_id",id).order("created_at"),
  supabase.from("subjects").select("name,code").eq("id",assessment.subject_id).eq("school_id",school.id).maybeSingle(),
 ]);
 const submissions=await Promise.all((submissionsResult.data??[]).map(async item=>{const {data}=await supabase.storage.from("cognia-coursework").createSignedUrl(item.storage_path,600);return {...item,downloadUrl:data?.signedUrl??null};}));
 const resources=await Promise.all((resourcesResult.data??[]).map(async item=>{const {data}=await supabase.storage.from("cognia-coursework").createSignedUrl(item.storage_path,600);return {...item,downloadUrl:data?.signedUrl??null};}));
 const studentIds=[...new Set((rosterResult.data??[]).map((r:{student_id:string})=>r.student_id))];
 const students=studentIds.length?await supabase.from("students").select("id,first_name,middle_name,surname,student_number").eq("school_id",school.id).in("id",studentIds):{data:[],error:null};
 return <><div className="mb-4"><Link href="/admin/assessments" className="text-sm font-semibold text-indigo-700">← Assessments</Link></div><PageHeading title={assessment.title} description={`${subjectResult.data?.code?`${subjectResult.data.code} · `:""}${subjectResult.data?.name??"Academic subject"} · ${assessment.assessment_type} · ${assessment.status}`} />
  <AssessmentDetailManager assessment={assessment} role={role} userId={userId} roster={(rosterResult.data??[]) as {student_id:string;student_number:string;first_name:string;middle_name:string|null;surname:string;score:number|null;remarks:string|null;is_published:boolean}[]} rosterError={Boolean(rosterResult.error)} students={students.data??[]} submissions={submissions} resources={resources}/>
 </>;
}
