import Link from "next/link";
import PageHeading from "@/components/page-heading";
import { getCurrentAttendanceSchool } from "@/lib/attendance-workspace";
import AssessmentManager from "./manager";

export default async function AssessmentsPage({searchParams}:{searchParams:Promise<{assessment?:string;search?:string}>}) {
  const params=await searchParams;const {supabase,school,role,userId}=await getCurrentAttendanceSchool();
  const [sessions,terms,classes,arms,subjects,programmes,levels,assessments]=await Promise.all([
    supabase.from("academic_sessions").select("id,name,is_active").eq("school_id",school.id).order("starts_on",{ascending:false}),
    supabase.from("academic_terms").select("id,name,academic_session_id,is_active").eq("school_id",school.id).order("starts_on"),
    supabase.from("school_classes").select("id,name").eq("school_id",school.id).order("sort_order").order("name"),
    supabase.from("class_arms").select("id,name,class_id").eq("school_id",school.id).order("sort_order").order("name"),
    supabase.from("subjects").select("id,name,code,is_active,programme_id,academic_level_id").eq("school_id",school.id).eq("is_active",true).order("name"),
    supabase.from("academic_programmes").select("id,name,is_active").eq("school_id",school.id).eq("is_active",true).order("name"),
    supabase.from("academic_levels").select("id,name,programme_id,is_active").eq("school_id",school.id).eq("is_active",true).order("sort_order").order("name"),
    supabase.from("assessments").select("id,title,assessment_model,assessment_type,academic_session_id,academic_term_id,class_id,class_arm_id,subject_id,programme_id,academic_level_id,maximum_marks,weight,assessment_date,submission_deadline,status,is_coursework,created_by,created_at").eq("school_id",school.id).order("created_at",{ascending:false}).limit(200),
  ]);
  const error=[sessions,terms,classes,arms,subjects,programmes,levels,assessments].some(x=>x.error);
  const assignmentResult=role==="teacher"?await supabase.from("attendance_staff_assignments").select("assignment_type,academic_session_id,class_id,class_arm_id,subject_id").eq("school_id",school.id).eq("teacher_user_id",userId).eq("is_active",true):{data:[],error:null};
  const selected=(assessments.data??[]).find(a=>a.id===params.assessment);
  const roster=selected?await supabase.rpc("get_assessment_roster",{target_assessment:selected.id}):{data:[],error:null};
  const subjectIds=[...new Set((assessments.data??[]).map(a=>a.subject_id))];
  const selectedSubjects=subjectIds.length?await supabase.from("subjects").select("id,name,code").eq("school_id",school.id).in("id",subjectIds):{data:[],error:null};
  const rows=(assessments.data??[]).filter(a=>!params.search||`${a.title} ${a.assessment_type}`.toLowerCase().includes(params.search.toLowerCase()));
  return <><PageHeading title="Assessment & coursework" description={`Continuous assessment for ${school.name}.`} />
    <div className="mb-4 flex justify-end"><Link href="/admin/assessments/export" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Export academic assessment report</Link></div>
    {error||assignmentResult.error?<section className="card p-6 text-sm text-rose-700" role="alert">Academic assessment data could not be loaded. Refresh or contact your administrator.</section>:<AssessmentManager role={role} userId={userId} institutionType={school.institution_type} sessions={sessions.data??[]} terms={terms.data??[]} classes={classes.data??[]} arms={arms.data??[]} subjects={subjects.data??[]} programmes={programmes.data??[]} levels={levels.data??[]} assignments={assignmentResult.data??[]} assessments={rows} subjectLabels={selectedSubjects.data??[]} selected={selected??null} roster={roster.data??[]} rosterError={Boolean(roster.error)} />}
    <form className="mt-4 flex flex-wrap gap-2"><input name="search" defaultValue={params.search} placeholder="Search assessments" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"/><button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold">Search</button>{params.search&&<Link href="/admin/assessments" className="px-3 py-2 text-sm text-indigo-700">Clear</Link>}</form>
  </>;
}
