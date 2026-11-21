import PageHeading from "@/components/page-heading";
import CsvDownload from "@/components/csv-download";
import { getCurrentSchool } from "@/lib/current-school";

export default async function AttendanceSummaryPage(){
 const {school,supabase}=await getCurrentSchool();
 const [{data:sessions},{data:records},{data:attendanceSessions}]=await Promise.all([
  supabase.from("attendance_sessions").select("id,attendance_date,attendance_model,session_label,school_id").eq("school_id",school.id).order("attendance_date",{ascending:false}),
  supabase.from("attendance_records").select("status,student_id,attendance_session_id").eq("school_id",school.id),
  supabase.from("attendance_sessions").select("id").eq("school_id",school.id)
 ]);
 const counts={present:0,absent:0,late:0,excused:0};
 (records??[]).forEach(r=>{if(r.status in counts)counts[r.status as keyof typeof counts]++;});
 const total=(records??[]).length;
 const rows=(sessions??[]).map(s=>{const rs=(records??[]).filter(r=>r.attendance_session_id===s.id);const present=rs.filter(r=>r.status==="present").length;return {date:s.attendance_date,label:s.session_label,model:s.attendance_model,total:rs.length,present,rate:rs.length?present/rs.length*100:null};});
 const csv=["Date,Session,Model,Records,Present,Attendance Rate"].join(",")+"\n"+rows.map(r=>[r.date,r.label,r.model,r.total,r.present,r.rate?.toFixed(1)??""].join(",")).join("\n");
 return <><PageHeading title="Attendance analytics" description={`School-wide attendance and absence trends for ${school.name}.`} action={<CsvDownload csv={csv} filename={`attendance-summary-${new Date().toISOString().slice(0,10)}.csv`} disabled={!rows.length}/>}/><section className="mb-5 grid gap-4 sm:grid-cols-5"><div className="card p-4"><p className="text-xs text-slate-500">Registers</p><p className="mt-1 text-2xl font-bold">{attendanceSessions?.length||0}</p></div>{Object.entries(counts).map(([status,count])=><div className="card p-4" key={status}><p className="text-xs capitalize text-slate-500">{status}</p><p className="mt-1 text-2xl font-bold">{count}</p></div>)}</section><section className="mb-5 card p-5"><p className="text-sm text-slate-500">Overall recorded attendance rate</p><p className="mt-1 text-3xl font-bold text-indigo-700">{total?((counts.present/total)*100).toFixed(1):"0.0"}%</p></section><section className="card overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className="p-3 text-left">Date</th><th className="p-3 text-left">Session</th><th className="p-3 text-left">Model</th><th className="p-3 text-right">Records</th><th className="p-3 text-right">Present</th><th className="p-3 text-right">Rate</th></tr></thead><tbody>{rows.map(r=><tr key={`${r.date}-${r.label}`} className="border-t"><td className="p-3">{r.date}</td><td className="p-3">{r.label}</td><td className="p-3 capitalize">{r.model}</td><td className="p-3 text-right">{r.total}</td><td className="p-3 text-right">{r.present}</td><td className="p-3 text-right font-semibold">{r.rate?.toFixed(1)??"—"}%</td></tr>)}</tbody></table></div>{!rows.length&&<p className="p-8 text-center text-slate-500">No attendance sessions have been recorded.</p>}</section></>;
}
