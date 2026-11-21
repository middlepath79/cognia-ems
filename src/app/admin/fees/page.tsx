import PageHeading from "@/components/page-heading";
import CsvDownload from "@/components/csv-download";
import { getCurrentSchool } from "@/lib/current-school";
import FeesManager from "./fees-manager";

export default async function FeesPage(){
 const {school,supabase}=await getCurrentSchool();
 const [{data:categories},{data:structures},{data:students},{data:sessions},{data:terms},{data:arms},{data:programmes},{data:levels},{data:invoices},{data:payments}]=await Promise.all([
  supabase.from("fee_categories").select("id,name,code,description,is_active").eq("school_id",school.id).order("name"),
  supabase.from("fee_structures").select("id,name,amount,due_date,structure_type,academic_session_id,academic_term_id").eq("school_id",school.id).eq("is_active",true).order("name"),
  supabase.from("students").select("id,student_number,first_name,middle_name,surname").eq("school_id",school.id).eq("status","active").order("surname"),
  supabase.from("academic_sessions").select("id,name").eq("school_id",school.id).order("start_date",{ascending:false}),
  supabase.from("academic_terms").select("id,name,academic_session_id").eq("school_id",school.id).order("starts_on",{ascending:false}),
  supabase.from("class_arms").select("id,name").eq("school_id",school.id),
  supabase.from("academic_programmes").select("id,name").eq("school_id",school.id),
  supabase.from("academic_levels").select("id,name,programme_id").eq("school_id",school.id),
  supabase.from("fee_invoices").select("id,student_id,invoice_number,subtotal,discount,total,status,due_date,issued_at").eq("school_id",school.id).order("issued_at",{ascending:false}),
  supabase.from("fee_payments").select("id,invoice_id,receipt_number,amount,payment_method,paid_at,reference").eq("school_id",school.id).order("paid_at",{ascending:false})
 ]);
 const invoiceRows=invoices??[];
 const paidByInvoice=new Map<string,number>();(payments??[]).forEach(p=>paidByInvoice.set(p.invoice_id,(paidByInvoice.get(p.invoice_id)||0)+Number(p.amount)));
 const balances=invoiceRows.map(i=>({invoice:i.invoice_number,student:((students??[]).find(s=>s.id===i.student_id)),total:Number(i.total),paid:paidByInvoice.get(i.id)||0,balance:Math.max(0,Number(i.total)-(paidByInvoice.get(i.id)||0)),status:i.status}));
 const csv=["Invoice,Student,Total,Paid,Balance,Status"].join(",")+"\n"+balances.map(r=>[r.invoice,[r.student?.first_name,r.student?.middle_name,r.student?.surname].filter(Boolean).join(" "),r.total.toFixed(2),r.paid.toFixed(2),r.balance.toFixed(2),r.status].map(v=>{const s=String(v??"");return /[,\"\n]/.test(s)?`"${s.replaceAll("\"","\"\"")}"`:s}).join(",")).join("\n");
 return <>
  <PageHeading title="Fees & Payments" description={`Manual fee management and payment tracking for ${school.name}.`} action={<CsvDownload csv={csv} filename={`fee-balances-${new Date().toISOString().slice(0,10)}.csv`} disabled={!balances.length}/>}/>
  <FeesManager categories={categories??[]} structures={structures??[]} students={students??[]} sessions={sessions??[]} terms={terms??[]} arms={arms??[]} programmes={programmes??[]} levels={levels??[]} invoices={invoiceRows} payments={payments??[]} balances={balances}/>
 </>;
}
