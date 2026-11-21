"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentAttendanceSchool } from "@/lib/attendance-workspace";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const get=(f:FormData,k:string)=>String(f.get(k)??"").trim();
function adminOnly(){return getCurrentAttendanceSchool().then(ctx=>{if(ctx.role!=="school_admin")redirect("/portal");return ctx;});}
function refresh(){revalidatePath("/admin/timetable");revalidatePath("/portal");}

export async function createTimetablePlanAction(form:FormData){
 const {supabase,school,userId}=await adminOnly();const session=get(form,"academicSessionId"),term=get(form,"academicTermId"),model=get(form,"model"),name=get(form,"name");
 if(!uuid.test(session)||!uuid.test(term)||!['class','course'].includes(model)||name.length<2||name.length>120)redirect("/admin/timetable?view=builder&error=plan");
 const [sessionResult,termResult]=await Promise.all([supabase.from("academic_sessions").select("id").eq("id",session).eq("school_id",school.id).eq("is_active",true).maybeSingle(),supabase.from("academic_terms").select("id").eq("id",term).eq("school_id",school.id).eq("academic_session_id",session).eq("is_active",true).maybeSingle()]);
 if(!sessionResult.data||!termResult.data)redirect("/admin/timetable?view=builder&error=plan");
 const {data,error}=await supabase.from("timetable_plans").insert({school_id:school.id,academic_session_id:session,academic_term_id:term,scheduling_model:model,name,created_by:userId,updated_by:userId}).select("id").single();
 if(error||!data){console.error("Timetable plan save failed",error?.message);redirect("/admin/timetable?view=builder&error=plan");}
 refresh();redirect(`/admin/timetable?view=builder&plan=${data.id}&saved=plan`);
}

export async function saveTimetableEntryAction(form:FormData){
 const {supabase,school}=await adminOnly();const id=get(form,"id"),planId=get(form,"planId"),model=get(form,"model"),weekday=Number(get(form,"weekday")),starts=get(form,"startsAt"),ends=get(form,"endsAt"),classId=get(form,"classId"),armId=get(form,"classArmId"),subjectId=get(form,"subjectId"),programmeId=get(form,"programmeId"),levelId=get(form,"academicLevelId"),staffId=get(form,"staffUserId"),venueId=get(form,"venueId"),kind=get(form,"sessionKind"),description=get(form,"description");
 if(!uuid.test(planId)||(id&&!uuid.test(id))||!['class','course'].includes(model)||!Number.isInteger(weekday)||weekday<0||weekday>6||!/^([01]\d|2[0-3]):[0-5]\d$/.test(starts)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(ends)||starts>=ends||!uuid.test(subjectId)||!uuid.test(staffId)||(venueId&&!uuid.test(venueId))||(model==='class'&&(!uuid.test(classId)||(armId&&!uuid.test(armId))))||(model==='course'&&(!uuid.test(programmeId)||!uuid.test(levelId)))||!['lesson','lecture','practical','tutorial','workshop','other'].includes(kind)||description.length>500)redirect("/admin/timetable?view=builder&error=entry");
 const {data:plan,error:planError}=await supabase.from("timetable_plans").select("id,scheduling_model,status").eq("id",planId).eq("school_id",school.id).maybeSingle();if(planError||!plan||plan.status==='archived'||plan.scheduling_model!==model)redirect(`/admin/timetable?view=builder&plan=${planId}&error=plan`);
 const values={school_id:school.id,timetable_plan_id:planId,scheduling_model:model,weekday,starts_at:starts,ends_at:ends,class_id:model==='class'?classId:null,class_arm_id:model==='class'?(armId||null):null,subject_id:subjectId,programme_id:model==='course'?programmeId:null,academic_level_id:model==='course'?levelId:null,staff_user_id:staffId,venue_id:venueId||null,session_kind:kind,description:description||null,is_active:true,updated_at:new Date().toISOString()};
  const result=id?await supabase.from("timetable_entries").update(values).eq("id",id).eq("school_id",school.id).select("id").maybeSingle():await supabase.from("timetable_entries").insert(values).select("id").maybeSingle();
  const error=result.error;
  if(!error&&!result.data)redirect(`/admin/timetable?view=builder&plan=${planId}&error=entry`);
  if(error){
   console.error("Timetable entry save failed",error.message);
   let errorKind="entry"; if(error.code==="23P01")errorKind="conflict";else if(error.code==="42501")errorKind="staff";
   redirect(`/admin/timetable?view=builder&plan=${planId}&error=${errorKind}`);
  }
  refresh();redirect(`/admin/timetable?view=builder&plan=${planId}&saved=entry`);
}

export async function changeTimetablePlanStatusAction(form:FormData){
 const {supabase,school,userId}=await adminOnly();const id=get(form,"id"),status=get(form,"status");if(!uuid.test(id)||!['published','archived','draft'].includes(status))redirect("/admin/timetable?error=plan");
  const publishedAt=status==="published"?new Date().toISOString():null;
  const {error}=await supabase.from("timetable_plans").update({status,published_at:publishedAt,updated_by:userId}).eq("id",id).eq("school_id",school.id);
  if(error){console.error("Timetable publication change failed",error.message);redirect(`/admin/timetable?error=${error.code==="23P01"?"conflict":"publish"}`);}
  refresh();const nextView=status==="published"?"published":"overview";redirect(`/admin/timetable?view=${nextView}&saved=${status}`);
}

export async function setTimetableEntryActiveAction(form:FormData){const {supabase,school}=await adminOnly();const id=get(form,"id"),active=get(form,"active")==="true",planId=get(form,"planId");if(!uuid.test(id)||!uuid.test(planId))redirect("/admin/timetable?view=builder&error=entry");const {error}=await supabase.from("timetable_entries").update({is_active:active,updated_at:new Date().toISOString()}).eq("id",id).eq("school_id",school.id);if(error){console.error("Timetable entry status update failed",error.message);redirect(`/admin/timetable?view=builder&plan=${planId}&error=entry`);}refresh();redirect(`/admin/timetable?view=builder&plan=${planId}&saved=entry`);}

export async function saveVenueAction(form:FormData){
 const {supabase,school,userId}=await adminOnly();const id=get(form,"id"),name=get(form,"name"),code=get(form,"code"),type=get(form,"venueType"),capacityRaw=get(form,"capacity"),building=get(form,"building"),description=get(form,"description");const capacity=capacityRaw?Number(capacityRaw):null;
 if((id&&!uuid.test(id))||name.length<2||name.length>120||code.length>32||type.length<1||type.length>48||(capacity!==null&&(!Number.isInteger(capacity)||capacity<1))||building.length>120||description.length>500)redirect("/admin/timetable?view=venues&error=venue");
 const values={school_id:school.id,name,code:code||null,venue_type:type,capacity,building:building||null,description:description||null};const q=id?supabase.from("learning_venues").update(values).eq("id",id).eq("school_id",school.id):supabase.from("learning_venues").insert({...values,created_by:userId});const {error}=await q;if(error){console.error("Venue save failed",error.message);redirect("/admin/timetable?view=venues&error=venue");}refresh();redirect("/admin/timetable?view=venues&saved=venue");
}

export async function setVenueActiveAction(form:FormData){const {supabase,school}=await adminOnly();const id=get(form,"id"),active=get(form,"active")==='true';if(!uuid.test(id))redirect("/admin/timetable?view=venues&error=venue");const {error}=await supabase.from("learning_venues").update({is_active:active}).eq("id",id).eq("school_id",school.id);if(error)redirect("/admin/timetable?view=venues&error=venue");refresh();redirect("/admin/timetable?view=venues&saved=venue");}
