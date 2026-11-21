"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSchool } from "@/lib/current-school";

export type FeeState={error?:string;success?:string};
const v=(f:FormData,k:string)=>String(f.get(k)??"").trim();
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function saveFeeCategory(_s:FeeState,f:FormData):Promise<FeeState>{
 const name=v(f,"name"),code=v(f,"code"),description=v(f,"description");if(name.length<1||name.length>120||code.length>32||description.length>1000)return {error:"Enter a valid fee category name and details."};
 const {supabase,school,userId}=await getCurrentSchool();
 const {error}=await supabase.from("fee_categories").insert({school_id:school.id,name,code:code||null,description:description||null,created_by:userId});
 if(error)return {error:error.code==="23505"?"This fee category already exists.":"The fee category could not be saved."};revalidatePath("/admin/fees");return {success:"Fee category created."};
}

export async function saveFeeStructure(_s:FeeState,f:FormData):Promise<FeeState>{
 const name=v(f,"name"),category=v(f,"categoryId"),session=v(f,"sessionId"),term=v(f,"termId"),amount=Number(v(f,"amount")),due=v(f,"dueDate"),type=v(f,"structureType"),arm=v(f,"classArmId"),programme=v(f,"programmeId"),level=v(f,"levelId");
 if(name.length<1||name.length>160||!uuid.test(category)||!uuid.test(session)||!uuid.test(term)||!Number.isFinite(amount)||amount<0||!["basic","programme"].includes(type)||(type==="basic"?!uuid.test(arm):(!uuid.test(programme)||!uuid.test(level))))return {error:"Complete the fee structure and academic scope."};
 const {supabase,school,userId}=await getCurrentSchool();
 const {error}=await supabase.from("fee_structures").insert({school_id:school.id,name,category_id:category,academic_session_id:session,academic_term_id:term,structure_type:type,class_arm_id:type==="basic"?arm:null,programme_id:type==="programme"?programme:null,academic_level_id:type==="programme"?level:null,amount,due_date:due||null,created_by:userId});
 if(error)return {error:"The fee structure could not be saved. Verify the selected academic records."};revalidatePath("/admin/fees");return {success:"Fee structure created."};
}

export async function assignStudentFee(_s:FeeState,f:FormData):Promise<FeeState>{
 const student=v(f,"studentId"),structure=v(f,"structureId"),amount=Number(v(f,"amount")),due=v(f,"dueDate");if(!uuid.test(student)||!uuid.test(structure)||!Number.isFinite(amount)||amount<0)return {error:"Choose a student and fee structure."};
 const {supabase,school,userId}=await getCurrentSchool();
 const [{data:s},{data:fs}]=await Promise.all([supabase.from("students").select("id").eq("id",student).eq("school_id",school.id).maybeSingle(),supabase.from("fee_structures").select("id,amount,due_date").eq("id",structure).eq("school_id",school.id).eq("is_active",true).maybeSingle()]);
 if(!s||!fs)return {error:"Student or fee structure is outside this institution."};
 const {error}=await supabase.from("student_fee_assignments").insert({school_id:school.id,student_id:student,fee_structure_id:structure,amount:amount||Number(fs.amount),due_date:due||fs.due_date,created_by:userId});
 if(error)return {error:error.code==="23505"?"This fee is already assigned to the student.":"The fee assignment could not be saved."};revalidatePath("/admin/fees");return {success:"Student fee assigned."};
}

export async function createFeeInvoice(_s:FeeState,f:FormData):Promise<FeeState>{
 const student=v(f,"studentId"),session=v(f,"sessionId"),term=v(f,"termId"),amount=Number(v(f,"amount")),discount=Number(v(f,"discount")||"0"),due=v(f,"dueDate"),notes=v(f,"notes");
 if(!uuid.test(student)||!uuid.test(session)||!uuid.test(term)||!Number.isFinite(amount)||amount<0||!Number.isFinite(discount)||discount<0||discount>amount||notes.length>2000)return {error:"Enter a valid student, period and invoice amount."};
 const {supabase,school,userId}=await getCurrentSchool();
 const [{data:s},{data:p}]=await Promise.all([supabase.from("students").select("id").eq("id",student).eq("school_id",school.id).maybeSingle(),supabase.from("institution_preferences").select("invoice_prefix").eq("school_id",school.id).maybeSingle()]);
 if(!s)return {error:"Student is outside this institution."};
 const {count}=await supabase.from("fee_invoices").select("id",{count:"exact",head:true}).eq("school_id",school.id);
 const invoiceNumber=`${p?.invoice_prefix||"INV"}-${String((count??0)+1).padStart(6,"0")}`;
 const total=amount-discount;
 const {data,error}=await supabase.from("fee_invoices").insert({school_id:school.id,student_id:student,invoice_number:invoiceNumber,academic_session_id:session,academic_term_id:term,issued_at:new Date().toISOString().slice(0,10),due_date:due||null,subtotal:amount,discount,total,status:"issued",notes:notes||null,created_by:userId}).select("id").maybeSingle();
 if(error||!data)return {error:"The invoice could not be created."};
 await supabase.from("fee_invoice_items").insert({school_id:school.id,invoice_id:data.id,description:"Institution fee charge",amount});
 revalidatePath("/admin/fees");return {success:`Invoice ${invoiceNumber} created.`};
}

export async function recordFeePayment(_s:FeeState,f:FormData):Promise<FeeState>{
 const invoice=v(f,"invoiceId"),amount=Number(v(f,"amount")),method=v(f,"paymentMethod"),reference=v(f,"reference"),notes=v(f,"notes"),paid=v(f,"paidAt");
 if(!uuid.test(invoice)||!Number.isFinite(amount)||amount<=0||reference.length>160||notes.length>1000||!["cash","bank_transfer","card","cheque","mobile_money","other"].includes(method))return {error:"Enter a valid invoice, positive payment amount and method."};
 const {supabase,school,userId}=await getCurrentSchool();
 const {data:invoiceRow}=await supabase.from("fee_invoices").select("id,total,status").eq("id",invoice).eq("school_id",school.id).maybeSingle();if(!invoiceRow||invoiceRow.status==="void")return {error:"Invoice is void or outside this institution."};
 const {data:payments}=await supabase.from("fee_payments").select("amount").eq("invoice_id",invoice).eq("school_id",school.id);
 const paidAlready=(payments??[]).reduce((sum,p)=>sum+Number(p.amount),0);
 if(paidAlready+amount>Number(invoiceRow.total))return {error:"Payment would exceed the invoice balance."};
 const {count}=await supabase.from("fee_payments").select("id",{count:"exact",head:true}).eq("school_id",school.id);
 const receipt=`RCT-${String((count??0)+1).padStart(8,"0")}`;
 const {error}=await supabase.from("fee_payments").insert({school_id:school.id,invoice_id:invoice,receipt_number:receipt,amount,paid_at:paid?new Date(paid).toISOString():new Date().toISOString(),payment_method:method,reference:reference||null,notes:notes||null,recorded_by:userId});
 if(error)return {error:"The payment could not be recorded."};
 await supabase.rpc("recalculate_invoice_status",{target_invoice:invoice,target_school:school.id});
 revalidatePath("/admin/fees");return {success:`Payment ${receipt} recorded.`};
}
