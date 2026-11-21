import Link from "next/link";
import PageHeading from "@/components/page-heading";
import { getCurrentAttendanceSchool } from "@/lib/attendance-workspace";
import ExaminationManager from "./manager";

export default async function ExaminationsPage({searchParams}:{searchParams:Promise<{search?:string;session?:string;term?:string}>}){
 const params=await searchParams;const {supabase,school,role,userId}=await getCurrentAttendanceSchool();
 const [sessions,terms,classes,arms,subjects,programmes,levels,exams]=await Promise.all([
  supabase.from("academic_sessions").select("id,name,is_active").eq("school_id",school.id).order("starts_on",{ascending:false}),
  supabase.from("academic_terms").select("id,name,academic_session_id,is_active").eq("school_id",school.id).order("starts_on"),
  supabase.from("school_classes").select("id,name").eq("school_id",school.id).order("sort_order").order("name"),
  supabase.from("class_arms").select("id,name,class_id").eq("school_id",school.id).order("sort_order").order("name"),
  supabase.from("subjects").select("id,name,code,is_active,programme_id,academic_level_id").eq("school_id",school.id).eq("is_active",true).order("name"),
  supabase.from("academic_programmes").select("id,name,is_active").eq("school_id",school.id).eq("is_active",true).order("name"),
  supabase.from("academic_levels").select("id,name,programme_id,is_active").eq("school_id",school.id).eq("is_active",true).order("sort_order").order("name"),
  supabase.from("examinations").select("id,name,examination_type,assessment_model,academic_session_id,academic_term_id,class_id,class_arm_id,subject_id,programme_id,academic_level_id,examination_date,starts_at,ends_at,venue,maximum_marks,contribution_weight,status,created_at").eq("school_id",school.id).order("created_at",{ascending:false}).limit(300),
 ]);
 const assignment=role==="teacher"?await supabase.from("attendance_staff_assignments").select("assignment_type,academic_session_id,class_id,class_arm_id,subject_id").eq("school_id",school.id).eq("teacher_user_id",userId).eq("is_active",true):{data:[],error:null};
 const labels=await supabase.from("subjects").select("id,name,code").eq("school_id",school.id);
 const errors=[sessions,terms,classes,arms,subjects,programmes,levels,exams,assignment,labels].some(x=>x.error);
 const list=(exams.data??[]).filter(e=>(!params.search||`${e.name} ${e.examination_type}`.toLowerCase().includes(params.search.toLowerCase()))&&(!params.session||e.academic_session_id===params.session)&&(!params.term||e.academic_term_id===params.term));
 return <><PageHeading title="Examinations & results" description={`Examination planning and controlled results for ${school.name}.`}/><div className="mb-4 flex justify-end"><Link href="/admin/examinations/export" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Export result report</Link></div>{errors?<section className="card p-6 text-sm text-rose-700" role="alert">Examination data is unavailable. The Phase 4D database migration may still be pending deployment.</section>:<ExaminationManager role={role} institutionType={school.institution_type} sessions={sessions.data??[]} terms={terms.data??[]} classes={classes.data??[]} arms={arms.data??[]} subjects={subjects.data??[]} programmes={programmes.data??[]} levels={levels.data??[]} assignments={assignment.data??[]} examinations={list} subjectLabels={labels.data??[]}/>}<form className="mt-4 flex flex-wrap gap-2"><input name="search" defaultValue={params.search} placeholder="Search examinations" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"/><select name="session" defaultValue={params.session??""} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">All sessions</option>{(sessions.data??[]).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><select name="term" defaultValue={params.term??""} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">All periods</option>{(terms.data??[]).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold">Filter</button></form></>;
}
