import { NextRequest } from "next/server";
import { getCurrentAttendanceSchool } from "@/lib/attendance-workspace";

const cell=(v:unknown)=>`"${String(v??"").replaceAll('"','""')}"`;
export async function GET(request:NextRequest){
 const {supabase,school}=await getCurrentAttendanceSchool();const params=request.nextUrl.searchParams;
 let query=supabase.from("assessments").select("id,title,assessment_model,subject_id,class_arm_id,programme_id,academic_level_id,academic_session_id,academic_term_id,maximum_marks,weight,status").eq("school_id",school.id).in("status",["published","closed"]).order("title");
 const session=params.get("sessionId"),term=params.get("termId");if(session)query=query.eq("academic_session_id",session);if(term)query=query.eq("academic_term_id",term);
 const {data:assessments,error}=await query.limit(300);if(error)return new Response("Assessment report unavailable",{status:403});
 const byStudent=new Map<string,{scope:string;number:string;name:string;done:number;missing:number;weighted:number;marks:Map<string,string>}>();
 const statistics=new Map<string,number[]>();const rosterCounts=new Map<string,number>();
 for(const assessment of assessments??[]){const {data:roster,error:rosterError}=await supabase.rpc("get_assessment_roster",{target_assessment:assessment.id});if(rosterError)continue;
  const rosterRows=(roster??[]) as {student_id:string;student_number:string;first_name:string;middle_name:string|null;surname:string;score:number|null}[];
  const scope=assessment.assessment_model==="class"?`class-arm:${assessment.class_arm_id}`:`programme:${assessment.programme_id}/level:${assessment.academic_level_id}`;const aggregateScope=`${scope}:${assessment.subject_id}:${assessment.academic_session_id}:${assessment.academic_term_id}`;rosterCounts.set(assessment.id,rosterRows.length);statistics.set(assessment.id,rosterRows.filter(r=>r.score!==null).map(r=>Number(r.score)));
  for(const student of rosterRows){const key=`${student.student_id}:${assessment.assessment_model}:${aggregateScope}`;const row=byStudent.get(key)??{scope:`${assessment.assessment_model} · ${aggregateScope}`,number:student.student_number,name:`${student.first_name} ${student.middle_name?`${student.middle_name} `:""}${student.surname}`,done:0,missing:0,weighted:0,marks:new Map<string,string>()};
   if(student.score===null){row.missing++;row.marks.set(assessment.title,"");}else{row.done++;row.weighted+=Number(student.score)/Number(assessment.maximum_marks)*Number(assessment.weight);row.marks.set(assessment.title,`${student.score}/${assessment.maximum_marks}`);}byStudent.set(key,row);
  }
 }
 const headers=["Academic scope","Student ID","Student","Assessments completed","Missing marks","Continuous assessment weighted total",...(assessments??[]).map(a=>a.title)];
 const detailRows=[...byStudent.values()].sort((a,b)=>a.scope.localeCompare(b.scope)||a.name.localeCompare(b.name)).map(row=>[row.scope,row.number,row.name,row.done,row.missing,row.weighted.toFixed(2),...(assessments??[]).map(a=>row.marks.get(a.title)??"")].map(cell).join(","));
 const summaryRows=(assessments??[]).flatMap(a=>{const values=statistics.get(a.id)??[];const count=rosterCounts.get(a.id)??0;const summaries=["Average","Highest","Lowest","Completion rate"];return summaries.map(label=>["ASSESSMENT SUMMARY",label,a.title,"","","",...(assessments??[]).map(other=>other.id!==a.id?"":label==="Average"?(values.length?(values.reduce((s,n)=>s+n,0)/values.length).toFixed(2):"—"):label==="Highest"?(values.length?Math.max(...values).toFixed(2):"—"):label==="Lowest"?(values.length?Math.min(...values).toFixed(2):"—"):`${count?Math.round(values.length/count*100):0}%`)].map(cell).join(","));});
 const lines=[headers.map(cell).join(","),...detailRows,...summaryRows];
 return new Response(`\uFEFF${lines.join("\r\n")}`,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":"attachment; filename=cognia-assessment-report.csv","Cache-Control":"no-store"}});
}
