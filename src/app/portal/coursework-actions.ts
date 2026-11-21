"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type SubmissionState={error?:string;success?:string};
export async function recordCourseworkSubmission(_state:SubmissionState,form:FormData):Promise<SubmissionState>{
 const schoolId=String(form.get("schoolId")??"");const assessmentId=String(form.get("assessmentId")??"");const path=String(form.get("storagePath")??"");const filename=String(form.get("filename")??"");const contentType=String(form.get("contentType")??"");const size=Number(form.get("fileSize"));
 if(!uuid.test(schoolId)||!uuid.test(assessmentId)||filename.length<1||filename.length>255||/[\\/\u0000-\u001f]/.test(filename)||!Number.isInteger(size)||size<1||size>20971520||path.length>500)return {error:"Choose a valid file of 20 MB or less."};
 const allowed=["application/pdf","image/jpeg","image/png","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/zip"];
 if(!allowed.includes(contentType))return {error:"This file type is not accepted."};
 const supabase=await createClient();const {data:claims}=await supabase.auth.getClaims();const userId=claims?.claims.sub;if(typeof userId!=="string")return {error:"Sign in to submit coursework."};
 const {data:student}=await supabase.from("students").select("id,school_id").eq("school_id",schoolId).eq("auth_user_id",userId).maybeSingle();if(!student)return {error:"Your student record is not linked to this institution."};
 const {data:member}=await supabase.from("school_memberships").select("school_id").eq("user_id",userId).eq("school_id",student.school_id).eq("role","student").eq("status","active").maybeSingle();
 if(!member)return {error:"Your student record is not linked to this institution."};
 const {data:assessment}=await supabase.from("assessments").select("id,school_id,submission_deadline,is_coursework,status,accepted_formats").eq("id",assessmentId).eq("school_id",member.school_id).eq("is_coursework",true).eq("status","published").maybeSingle();
 if(!assessment)return {error:"This coursework is no longer available."};
 const extension=filename.split(".").pop()?.toLowerCase()??"";if(assessment.accepted_formats.length&&!assessment.accepted_formats.includes(extension))return {error:"This file format is not accepted for this coursework."};
 const expectedPrefix=`${student.school_id}/${assessment.id}/${student.id}/`;if(!path.startsWith(expectedPrefix))return {error:"The uploaded file path is invalid."};
 const late=assessment.submission_deadline&&new Date(assessment.submission_deadline).getTime()<Date.now();
 const {data:existing}=await supabase.from("coursework_submissions").select("id,submission_status").eq("school_id",student.school_id).eq("assessment_id",assessment.id).eq("student_id",student.id).maybeSingle();
 const values={storage_path:path,original_filename:filename,content_type:contentType,file_size:size,submission_status:late?"late":"submitted",submitted_at:new Date().toISOString()};
 const result=existing?.submission_status==="returned"
  ?await supabase.from("coursework_submissions").update(values).eq("id",existing.id).eq("school_id",student.school_id).select("id").maybeSingle()
  :existing?{error:{code:"23505"}}:await supabase.from("coursework_submissions").insert({school_id:student.school_id,assessment_id:assessment.id,student_id:student.id,...values}).select("id").maybeSingle();
 if(result.error)return {error:result.error.code==="23505"?"A submission already exists. Resubmission is allowed after work is returned.":"The submission could not be recorded."};
 revalidatePath("/portal");return {success:existing?"Revised coursework submitted.":"Coursework submitted."};
}
