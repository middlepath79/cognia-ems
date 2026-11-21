"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAttendanceSchool } from "@/lib/attendance-workspace";

export type AssessmentActionState = { error?: string; success?: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const val = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const fail = (error: string): AssessmentActionState => ({ error });
const formatOptions=new Set(["pdf","jpg","jpeg","png","doc","docx","xls","xlsx","zip"]);
const decimalPlaces=(value:string)=>value.includes(".")?value.split(".")[1].length:0;
const refresh = () => { revalidatePath("/admin/assessments"); revalidatePath("/portal"); };

export async function createAssessmentAction(_state: AssessmentActionState, form: FormData): Promise<AssessmentActionState> {
  const model = val(form,"model"), title = val(form,"title"), assessmentType = val(form,"assessmentType");
  const session = val(form,"sessionId"), term = val(form,"termId"), subject = val(form,"subjectId");
  const classId = val(form,"classId"), armId = val(form,"classArmId"), programme = val(form,"programmeId"), level = val(form,"levelId");
  const maximum = Number(val(form,"maximumMarks")), weight = Number(val(form,"weight"));
  const acceptedFormats=[...new Set(val(form,"acceptedFormats").toLowerCase().split(",").map(x=>x.trim()).filter(Boolean))];
  const assessmentDate=val(form,"assessmentDate"),deadline=val(form,"deadline");
  if (!["class","course"].includes(model) || title.length<1 || title.length>160 || assessmentType.length<1 || assessmentType.length>60 || !uuid.test(session) || !uuid.test(term) || !uuid.test(subject) || !Number.isFinite(maximum) || maximum<=0 || decimalPlaces(val(form,"maximumMarks"))>2 || !Number.isFinite(weight) || weight<=0 || decimalPlaces(val(form,"weight"))>3 || (model==="class" && (!uuid.test(classId)||!uuid.test(armId))) || (model==="course"&&(!uuid.test(programme)||!uuid.test(level)))) return fail("Complete the required assessment details with marks to 2 decimals and weight to 3 decimals.");
  const {supabase,school,userId,role}=await getCurrentAttendanceSchool();
  if(role==="teacher"&&form.get("coursework")!=="on")return fail("Teachers may create coursework for their assigned teaching scope.");
  const basicInstitution=["early_childhood","basic","secondary"].includes(school.institution_type);
  if((basicInstitution&&model!=="class")||(!basicInstitution&&model!=="course"))return fail("This assessment context does not match the institution’s academic structure.");
  const [subjectRow,termRow,structureRow]=await Promise.all([
    supabase.from("subjects").select("id,programme_id,academic_level_id,is_active").eq("id",subject).eq("school_id",school.id).maybeSingle(),
    supabase.from("academic_terms").select("id").eq("id",term).eq("school_id",school.id).eq("academic_session_id",session).maybeSingle(),
    model==="class"?supabase.from("class_arms").select("id,class_id").eq("id",armId).eq("class_id",classId).eq("school_id",school.id).maybeSingle():supabase.from("academic_levels").select("id,programme_id").eq("id",level).eq("programme_id",programme).eq("school_id",school.id).maybeSingle(),
  ]);
  if(!subjectRow.data?.is_active||!termRow.data||!structureRow.data||(model==="course"&&((subjectRow.data.programme_id&&subjectRow.data.programme_id!==programme)||(subjectRow.data.academic_level_id&&subjectRow.data.academic_level_id!==level))))return fail("The selected subject or course does not match the active academic context.");
  if(acceptedFormats.some(x=>!formatOptions.has(x))||acceptedFormats.length>9)return fail("Choose accepted file formats from PDF, images, Office documents, or ZIP.");
  if((assessmentDate&&!/^\d{4}-\d{2}-\d{2}$/.test(assessmentDate))||(deadline&&!Number.isFinite(Date.parse(deadline))))return fail("Enter a valid assessment date and submission deadline.");
  const isCoursework=form.get("coursework")==="on";
  const row = {school_id:school.id,assessment_model:model,title,description:val(form,"description")||null,assessment_type:assessmentType,academic_session_id:session,academic_term_id:term,class_id:model==="class"?classId:null,class_arm_id:model==="class"?armId:null,subject_id:subject,programme_id:model==="course"?programme:null,academic_level_id:model==="course"?level:null,maximum_marks:maximum,weight,assessment_date:assessmentDate||null,submission_deadline:deadline?new Date(deadline).toISOString():null,instructions:val(form,"instructions")||null,accepted_formats:isCoursework?acceptedFormats:[],is_coursework:isCoursework,status:"draft",created_by:userId};
  const {error}=await supabase.from("assessments").insert(row);
  if(error){console.error("Assessment creation failed",error.message);return fail(error.code==="42501"?"You are not assigned to this academic context.":error.message.includes("weights")?"The assessment weight exceeds the institution grading limit.":"Assessment could not be saved. Verify the selected academic records.");}
  refresh();return {success:"Assessment saved as a draft."};
}

export async function updateAssessmentAction(_state:AssessmentActionState,form:FormData):Promise<AssessmentActionState>{
 const id=val(form,"id"),title=val(form,"title"),assessmentType=val(form,"assessmentType"),description=val(form,"description"),instructions=val(form,"instructions");
 const max=Number(val(form,"maximumMarks")),weight=Number(val(form,"weight"));
 if(!uuid.test(id)||title.length<1||title.length>160||assessmentType.length<1||assessmentType.length>60||description.length>2000||instructions.length>10000||!Number.isFinite(max)||max<=0||decimalPlaces(val(form,"maximumMarks"))>2||!Number.isFinite(weight)||weight<=0||decimalPlaces(val(form,"weight"))>3)return fail("Review the title, type, maximum marks, weight, and text lengths.");
 const {supabase,school,userId,role}=await getCurrentAttendanceSchool();
 const acceptedFormats=[...new Set(val(form,"acceptedFormats").toLowerCase().split(",").map(x=>x.trim()).filter(Boolean))];
 if(acceptedFormats.some(x=>!formatOptions.has(x))||acceptedFormats.length>9)return fail("Choose accepted formats from PDF, images, Office documents, or ZIP.");
 const {data:assessment,error:readError}=await supabase.from("assessments").select("id,status,is_coursework,created_by").eq("id",id).eq("school_id",school.id).maybeSingle();
 if(readError||!assessment)return fail("Assessment could not be found in this institution.");if(assessment.status!=="draft")return fail("Published and closed assessment configuration is locked. Create an authorized correction instead.");
 if(role==="teacher"&&(!assessment.is_coursework||assessment.created_by!==userId))return fail("Teachers may edit only their own assigned coursework drafts.");
 const dateValue=val(form,"assessmentDate");const deadline=val(form,"deadline");
 if((dateValue&&!/^\d{4}-\d{2}-\d{2}$/.test(dateValue))||(deadline&&!Number.isFinite(Date.parse(deadline))))return fail("Enter a valid assessment date and submission deadline.");
 const {data,error}=await supabase.from("assessments").update({title,assessment_type:assessmentType,description:description||null,instructions:instructions||null,maximum_marks:max,weight,assessment_date:dateValue||null,submission_deadline:deadline?new Date(deadline).toISOString():null,accepted_formats:assessment.is_coursework?acceptedFormats:[]}).eq("id",id).eq("school_id",school.id).eq("status","draft").select("id").maybeSingle();
 if(error||!data)return fail(error?.message.includes("weights")?"The assessment weight exceeds the institution grading limit.":"Assessment could not be updated.");refresh();return {success:"Draft assessment updated."};
}

export async function reviewCourseworkAction(_state:AssessmentActionState,form:FormData):Promise<AssessmentActionState>{
 const id=val(form,"submissionId"),raw=val(form,"score"),feedback=val(form,"feedback"),status=val(form,"submissionStatus");
 if(!uuid.test(id)||feedback.length>2000||!(["graded","returned"].includes(status))||(status==="graded"&&raw==="")||(raw!==""&&(!Number.isFinite(Number(raw))||Number(raw)<0||decimalPlaces(raw)>2)))return fail("Provide a valid score to two decimal places, feedback, and submission status.");
 const {supabase,school,userId,role}=await getCurrentAttendanceSchool();const {data:submission}=await supabase.from("coursework_submissions").select("id,school_id,assessment_id,student_id,storage_path").eq("id",id).eq("school_id",school.id).maybeSingle();
 if(!submission)return fail("This submission is outside your assigned teaching scope.");
 const {data:assessment}=await supabase.from("assessments").select("id,maximum_marks,is_coursework,status").eq("id",submission.assessment_id).eq("school_id",school.id).maybeSingle();if(!assessment?.is_coursework)return fail("The submission is not linked to coursework.");
 if(raw!==""&&Number(raw)>assessment.maximum_marks)return fail(`Score cannot exceed ${assessment.maximum_marks}.`);
 const existing=raw!==""||feedback||form.get("publishScore")==="on"?await supabase.from("assessment_scores").select("id,is_published").eq("school_id",school.id).eq("assessment_id",submission.assessment_id).eq("student_id",submission.student_id).maybeSingle():{data:null,error:null};
 if(existing.data?.is_published&&role!=="school_admin")return fail("Published marks need an administrator correction before regrading.");
 const {error:updateError}=await supabase.from("coursework_submissions").update({submission_status:status}).eq("id",id).eq("school_id",school.id);
 if(updateError)return fail("Coursework review could not be saved. Confirm that you are assigned to this class or course.");
 if(raw!==""||feedback||form.get("publishScore")==="on"){
  const {error:scoreError}=await supabase.from("assessment_scores").upsert({school_id:school.id,assessment_id:submission.assessment_id,student_id:submission.student_id,score:raw===""?null:Number(raw),remarks:feedback||null,is_published:form.get("publishScore")==="on",updated_by:userId},{onConflict:"school_id,assessment_id,student_id"});
  if(scoreError)return fail("Feedback was saved but the score could not be saved. Contact an administrator.");
 }
 refresh();return {success:"Coursework review saved."};
}

export async function saveAssessmentResourceAction(_state:AssessmentActionState,form:FormData):Promise<AssessmentActionState>{
 const assessmentId=val(form,"assessmentId"),title=val(form,"title"),path=val(form,"storagePath"),contentType=val(form,"contentType"),size=Number(val(form,"fileSize"));
 if(!uuid.test(assessmentId)||title.length<1||title.length>160||path.length>500||!Number.isInteger(size)||size<1||size>20971520)return fail("Check the resource name and file size (maximum 20 MB).");
 const {supabase,school,userId}=await getCurrentAttendanceSchool();const prefix=`${school.id}/${assessmentId}/resources/`;
 if(!path.startsWith(prefix))return fail("The resource file path is invalid.");
 const {error}=await supabase.from("assessment_resources").insert({school_id:school.id,assessment_id:assessmentId,title,storage_path:path,content_type:contentType,file_size:size,uploaded_by:userId});
 if(error)return fail("Learning resource could not be added to this draft assessment.");refresh();return {success:"Learning resource added."};
}

export async function removeAssessmentResourceAction(_state:AssessmentActionState,form:FormData):Promise<AssessmentActionState>{
 const id=val(form,"id");if(!uuid.test(id))return fail("Choose a valid learning resource.");const {supabase,school}=await getCurrentAttendanceSchool();
 const {error}=await supabase.from("assessment_resources").delete().eq("id",id).eq("school_id",school.id);if(error)return fail("Remove resources only while the assessment is a draft and in your assigned scope.");refresh();return {success:"Resource removed."};
}

export async function updateAssessmentStatusAction(_state: AssessmentActionState, form: FormData): Promise<AssessmentActionState> {
  const id=val(form,"id"),status=val(form,"status");if(!uuid.test(id)||!["published","closed","archived"].includes(status))return fail("Choose a valid assessment status.");
  const {supabase,school,role,userId}=await getCurrentAttendanceSchool();
  const {data:current}=await supabase.from("assessments").select("status,is_coursework,created_by").eq("id",id).eq("school_id",school.id).maybeSingle();
  if(!current)return fail("Assessment was not found in this institution.");
  if(role==="teacher"&&(!current.is_coursework||current.created_by!==userId))return fail("Teachers may publish or close only their own assigned coursework.");
  if(current.status==="archived")return fail("Archived assessments cannot be reopened.");
  if(status==="archived"&&role!=="school_admin")return fail("Only administrators may archive assessments.");
  if(current.status==="closed"&&status==="published"&&role!=="school_admin")return fail("Only an administrator may reopen a closed assessment.");
  if(status==="closed"&&current.status!=="published")return fail("Only a published assessment can be closed.");
  const {data,error}=await supabase.from("assessments").update({status}).eq("id",id).eq("school_id",school.id).select("id").maybeSingle();
  if(error||!data)return fail(error?.code==="42501"?"You are not assigned to this assessment.":"Assessment status could not be changed.");refresh();return {success:`Assessment ${status}.`};
}

export async function saveAssessmentScoresAction(_state: AssessmentActionState, form: FormData): Promise<AssessmentActionState> {
  const id=val(form,"assessmentId"), payload=val(form,"scores");if(!uuid.test(id)||payload.length>500000)return fail("The gradebook form is invalid.");
  let parsed:unknown;try{parsed=JSON.parse(payload);}catch{return fail("Refresh the gradebook and try again.");}
  if(!Array.isArray(parsed)||parsed.length>1000)return fail("The grade list could not be validated.");
  const rows=parsed as {studentId?:unknown;score?:unknown;remarks?:unknown}[];
  if(rows.some(r=>typeof r.studentId!=="string"||!uuid.test(r.studentId)||typeof r.remarks!=="string"||r.remarks.length>1000||(r.score!==null&&r.score!==""&&(typeof r.score!=="number"||!Number.isFinite(r.score)||r.score<0||Math.round(r.score*100)!==r.score*100))))return fail("Scores must be zero or higher with at most two decimal places, and remarks must be under 1,000 characters.");
  if(new Set(rows.map(r=>r.studentId)).size!==rows.length)return fail("The gradebook contains a duplicate student.");
  const {supabase,school,userId}=await getCurrentAttendanceSchool();
  const {data:roster,error:rosterError}=await supabase.rpc("get_assessment_roster",{target_assessment:id});
  if(rosterError||!roster)return fail("You cannot grade this assessment.");
  const eligible=new Set(roster.map((r:{student_id:string})=>r.student_id));if(rows.some(r=>!eligible.has(r.studentId as string)))return fail("A student is no longer eligible. Refresh the roster.");
  const saved=rows.filter(r=>r.score!==null&&r.score!=="").map(r=>({school_id:school.id,assessment_id:id,student_id:r.studentId as string,score:Number(r.score),remarks:(r.remarks as string).trim()||null,updated_by:userId}));
  const {error}=saved.length?await supabase.from("assessment_scores").upsert(saved,{onConflict:"school_id,assessment_id,student_id"}):{error:null};
  if(error){console.error("Score save failed",error.message);return fail(error.message.includes("maximum")?"A score is greater than the assessment maximum marks.":error.message.includes("Published scores")?"Published scores require an administrator correction.":"Scores could not be saved. Check the values and your assignment.");}
  refresh();return {success:`Saved ${saved.length} score${saved.length===1?"":"s"}.`};
}

export async function publishAssessmentScoresAction(_state: AssessmentActionState, form: FormData): Promise<AssessmentActionState> {
  const id=val(form,"assessmentId");if(!uuid.test(id))return fail("Choose an assessment.");
  const {supabase,school,userId}=await getCurrentAttendanceSchool();
  const {data:assessment}=await supabase.from("assessments").select("status").eq("id",id).eq("school_id",school.id).maybeSingle();
  if(!assessment||!["published","closed"].includes(assessment.status))return fail("Publish the assessment before publishing its scores.");
  const {data:roster,error}=await supabase.rpc("get_assessment_roster",{target_assessment:id});if(error||!roster)return fail("You cannot submit this assessment.");
  const ids=roster.map((r:{student_id:string})=>r.student_id);if(!ids.length)return fail("There are no eligible students in this assessment.");
  const {data:scores}=await supabase.from("assessment_scores").select("student_id,score").eq("school_id",school.id).eq("assessment_id",id).in("student_id",ids);
  if(!scores||scores.length!==ids.length||scores.some((s)=>s.score===null))return fail("Enter a score for every eligible student before submitting.");
  const {error:publishError}=await supabase.from("assessment_scores").update({is_published:true,submitted_at:new Date().toISOString(),updated_by:userId}).eq("school_id",school.id).eq("assessment_id",id).in("student_id",ids);
  if(publishError)return fail("The scores could not be published.");refresh();return {success:"Scores published to eligible students."};
}
