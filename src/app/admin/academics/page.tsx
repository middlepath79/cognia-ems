import PageHeading from "@/components/page-heading";
import AcademicManager from "./academic-manager";
import { getCurrentSchool } from "@/lib/current-school";

export default async function AcademicSessionsPage() {
  const { supabase, school } = await getCurrentSchool();
  const [{ data: sessions, error: sessionError }, { data: terms, error: termError }] = await Promise.all([
    supabase.from("academic_sessions").select("id, name, starts_on, ends_on, is_active").eq("school_id", school.id).order("starts_on", { ascending: false }),
    supabase.from("academic_terms").select("id, academic_session_id, name, starts_on, ends_on, is_active").eq("school_id", school.id).order("starts_on"),
  ]);
  if (sessionError || termError) {
    console.error("Unable to load academic sessions and terms", { sessionError: sessionError?.message, termError: termError?.message });
    return <><PageHeading title="Academic Calendar" description={`Manage the academic calendar for ${school.name}.`}/><div role="alert" className="card p-5 text-sm text-rose-700">Academic data could not be loaded. Refresh the page or contact support if this continues.</div></>;
  }
  return <><PageHeading title="Academic Calendar" description={`Manage academic years, dates and periods for ${school.name}.`}/><AcademicManager sessions={sessions ?? []} terms={terms ?? []}/></>;
}
