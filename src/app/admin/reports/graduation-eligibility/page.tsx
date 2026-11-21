import PageHeading from "@/components/page-heading";
import CsvDownload from "@/components/csv-download";
import { getCurrentSchool } from "@/lib/current-school";

export default async function GraduationEligibilityReport(){
 const {school,supabase}=await getCurrentSchool();
 const [{data:progress},{data:students},{data:programmes},{data:gpas},{data:finalResults}]=await Promise.all([
  supabase.from("academic_progress_records").select("student_id,progression_status,is_published,programme_id,academic_level_id").eq("school_id",school.id).eq("is_published",true),
  supabase.from("students").select("id,student_number,first_name,middle_name,surname,status").eq("school_id",school.id).in("status",["active","graduated"]),
  supabase.from("academic_programmes").select("id,name").eq("school_id",school.id),
  supabase.from("academic_period_gpas").select("student_id,cumulative_gpa").eq("school_id",school.id),
  supabase.from("academic_period_results").select("student_id,status,missing_components").eq("school_id",school.id)
 ]);
 const rows=(students??[]).map(s=>{
  const progressRecord=(progress??[]).filter(p=>p.student_id===s.id).at(-1);
  const programme=(programmes??[]).find(p=>p.id===progressRecord?.programme_id);
  const cgpas=(gpas??[]).filter(g=>g.student_id===s.id).map(g=>Number(g.cumulative_gpa)).filter(Number.isFinite);
  const incomplete=(finalResults??[]).filter(r=>r.student_id===s.id&&r.status!=="published").length;
  return {number:s.student_number,name:[s.first_name,s.middle_name,s.surname].filter(Boolean).join(" "),status:s.status,programme:programme?.name??"Not assigned",cgpa:cgpas.length?Math.max(...cgpas):null,progress:progressRecord?.progression_status??"Not decided",incomplete};
 });
 const eligible=rows.filter(r=>r.status==="active"&&r.progress==="completed"&&r.incomplete===0).length;
 const csv=["Student Number,Student,Programme,Status,CGPA,Progress,Incomplete Results"].join(",")+"\n"+rows.map(r=>[r.number,r.name,r.programme,r.status,r.cgpa??"",r.progress,r.incomplete].join(",")).join("\n");
 return <><PageHeading title="Graduation & completion" description={`Programme completion and graduation eligibility for ${school.name}.`} action={<CsvDownload csv={csv} filename={`graduation-eligibility-${new Date().toISOString().slice(0,10)}.csv`} disabled={!rows.length}/>}/><section className="mb-5 grid gap-4 sm:grid-cols-4"><div className="card p-4"><p className="text-xs text-slate-500">Candidates</p><p className="mt-1 text-2xl font-bold">{rows.length}</p></div><div className="card p-4"><p className="text-xs text-slate-500">Eligible</p><p className="mt-1 text-2xl font-bold text-emerald-700">{eligible}</p></div><div className="card p-4"><p className="text-xs text-slate-500">With incomplete results</p><p className="mt-1 text-2xl font-bold">{rows.filter(r=>r.incomplete>0).length}</p></div><div className="card p-4"><p className="text-xs text-slate-500">Graduated</p><p className="mt-1 text-2xl font-bold">{rows.filter(r=>r.status==="graduated").length}</p></div></section><section className="card overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"> <thead className="bg-slate-50"><tr><th className="p-3 text-left">Student</th><th className="p-3 text-left">Programme</th><th className="p-3 text-left">Progress</th><th className="p-3 text-right">CGPA</th><th className="p-3 text-right">Incomplete</th></tr></thead><tbody>{rows.map(r=><tr key={r.number} className="border-t"><td className="p-3"><p className="font-medium">{r.name}</p><p className="font-mono text-xs text-slate-500">{r.number}</p></td><td className="p-3">{r.programme}</td><td className="p-3 capitalize">{r.progress.replaceAll("_"," ")}</td><td className="p-3 text-right">{r.cgpa?.toFixed(2)??"—"}</td><td className="p-3 text-right">{r.incomplete}</td></tr>)}</tbody></table></div>{!rows.length&&<p className="p-8 text-center text-slate-500">No graduation candidates found.</p>}</section></>;
}
