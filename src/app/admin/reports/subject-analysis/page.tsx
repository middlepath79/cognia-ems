import PageHeading from "@/components/page-heading";
import CsvDownload from "@/components/csv-download";
import { getCurrentSchool } from "@/lib/current-school";

export default async function SubjectAnalysisPage(){
 const {school,supabase}=await getCurrentSchool();
 const [{data:subjects},{data:results},{data:assessments},{data:sessions},{data:terms}]=await Promise.all([
  supabase.from("subjects").select("id,name,code").eq("school_id",school.id).order("name"),
  supabase.from("final_results").select("subject_id,final_total,grade_point,status").eq("school_id",school.id).eq("status","published"),
  supabase.from("assessments").select("subject_id,status").eq("school_id",school.id),
  supabase.from("academic_sessions").select("id,name").eq("school_id",school.id).order("start_date",{ascending:false}),
  supabase.from("academic_terms").select("id,name").eq("school_id",school.id).order("starts_on",{ascending:false})
 ]);
 const rows=(subjects??[]).map(s=>{
  const rs=(results??[]).filter(r=>r.subject_id===s.id).map(r=>Number(r.final_total)).filter(Number.isFinite);
  const published=(assessments??[]).filter(a=>a.subject_id===s.id&&a.status==="published").length;
  return {subject:s.code?`${s.code} · ${s.name}`:s.name,students:rs.length,average:rs.length?rs.reduce((a,b)=>a+b,0)/rs.length:null,highest:rs.length?Math.max(...rs):null,lowest:rs.length?Math.min(...rs):null,assessments:published};
 });
 const csv=["Subject,Students,Average,Highest,Lowest,Published Assessments"].join(",")+"\n"+rows.map(r=>[r.subject,r.students,r.average?.toFixed(2)??"",r.highest??"",r.lowest??"",r.assessments].join(",")).join("\n");
 return <><PageHeading title="Subject performance analysis" description={`Subject and grade distribution analytics for ${school.name}.`} action={<CsvDownload csv={csv} filename={`subject-analysis-${new Date().toISOString().slice(0,10)}.csv`} disabled={!rows.length}/>}/><section className="mb-5 grid gap-4 sm:grid-cols-3"><div className="card p-4"><p className="text-xs text-slate-500">Subjects</p><p className="mt-1 text-2xl font-bold">{rows.length}</p></div><div className="card p-4"><p className="text-xs text-slate-500">Academic periods</p><p className="mt-1 text-2xl font-bold">{terms?.length||0}</p></div><div className="card p-4"><p className="text-xs text-slate-500">Sessions</p><p className="mt-1 text-2xl font-bold">{sessions?.length||0}</p></div></section><section className="card overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className="p-3 text-left">Subject</th><th className="p-3 text-right">Students</th><th className="p-3 text-right">Average</th><th className="p-3 text-right">Highest</th><th className="p-3 text-right">Lowest</th><th className="p-3 text-right">Assessments</th></tr></thead><tbody>{rows.map(r=><tr key={r.subject} className="border-t"><td className="p-3 font-medium">{r.subject}</td><td className="p-3 text-right">{r.students}</td><td className="p-3 text-right">{r.average?.toFixed(2)??"—"}</td><td className="p-3 text-right">{r.highest??"—"}</td><td className="p-3 text-right">{r.lowest??"—"}</td><td className="p-3 text-right">{r.assessments}</td></tr>)}</tbody></table></div>{!rows.length&&<p className="p-8 text-center text-slate-500">No subject results found.</p>}</section></>;
}
