"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { recordCourseworkSubmission, type SubmissionState } from "./coursework-actions";

const allowed=new Set(["application/pdf","image/jpeg","image/png","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/zip"]);
export default function CourseworkUpload({schoolId,studentId,assessmentId}:{schoolId:string;studentId:string;assessmentId:string}){
 const [busy,setBusy]=useState(false);const [state,setState]=useState<SubmissionState>({});
 async function submit(form:FormData){setState({});const file=form.get("file");if(!(file instanceof File)||!file.size||file.size>20*1024*1024){setState({error:"Choose a file of 20 MB or less."});return;}if(!allowed.has(file.type)){setState({error:"This file type is not accepted."});return;}setBusy(true);
  try{const path=`${schoolId}/${assessmentId}/${studentId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;const supabase=createClient();const {error}=await supabase.storage.from("cognia-coursework").upload(path,file,{contentType:file.type,upsert:false});if(error){setState({error:"The file could not be uploaded. Check your sign-in and try again."});return;}const data=new FormData();data.set("schoolId",schoolId);data.set("assessmentId",assessmentId);data.set("storagePath",path);data.set("filename",file.name);data.set("contentType",file.type);data.set("fileSize",String(file.size));const result=await recordCourseworkSubmission({},data);if(result.error)await supabase.storage.from("cognia-coursework").remove([path]);setState(result);}
  catch{setState({error:"The file could not be uploaded. Try again."});}finally{setBusy(false);}}
 return <form action={submit} className="mt-4 flex flex-wrap items-center gap-2"><input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.zip" required disabled={busy} className="max-w-full text-xs"/><button disabled={busy} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">{busy?"Submitting…":"Submit file"}</button>{state.error&&<p role="alert" className="w-full text-xs text-rose-700">{state.error}</p>}{state.success&&<p role="status" className="w-full text-xs text-emerald-700">{state.success}</p>}</form>;
}
