"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSchool } from "@/lib/current-school";

export type SettingsState={error?:string;success?:string};
const v=(f:FormData,k:string)=>String(f.get(k)??"").trim();

export async function saveInstitutionSettings(_s:SettingsState,f:FormData):Promise<SettingsState>{
 const name=v(f,"name"),logo=v(f,"logoUrl"),period=v(f,"academicPeriodLabel"),institutionType=v(f,"institutionType"),email=v(f,"contactEmail"),phone=v(f,"contactPhone"),address=v(f,"address"),timezone=v(f,"timezone"),currency=v(f,"currency"),locale=v(f,"locale"),invoicePrefix=v(f,"invoicePrefix"),receiptPrefix=v(f,"receiptPrefix");
 if(name.length<2||name.length>160||period.length<3||period.length>24||invoicePrefix.length<1||invoicePrefix.length>12||receiptPrefix.length<1||receiptPrefix.length>12||address.length>1000||email.length>254||phone.length>40)return {error:"Check the institution profile and prefix values."};
 if(logo){try{const url=new URL(logo);if(!["http:","https:"].includes(url.protocol))return {error:"Logo URL must use HTTP or HTTPS."};}catch{return {error:"Enter a valid logo URL."};}}
 const types=["early_childhood","basic","secondary","technical_vocational","college","polytechnic","monotechnic","university","postgraduate","professional_research","mixed"];
 if(!types.includes(institutionType))return {error:"Choose a valid institution academic model."};
 const {supabase,school,userId}=await getCurrentSchool();
 const {error}=await supabase.from("schools").update({name,logo_url:logo||null,academic_period_label:period,institution_type:institutionType}).eq("id",school.id).select("id").maybeSingle();
 if(error)return {error:"Institution profile could not be updated."};
 const {error:pError}=await supabase.from("institution_preferences").upsert({school_id:school.id,contact_email:email||null,contact_phone:phone||null,address:address||null,timezone,currency,locale,invoice_prefix:invoicePrefix,receipt_prefix:receiptPrefix,updated_by:userId},{onConflict:"school_id"});
 if(pError)return {error:"Profile was saved but institution preferences could not be saved."};
 revalidatePath("/admin/settings");revalidatePath("/admin");return {success:"Institution settings saved."};
}
