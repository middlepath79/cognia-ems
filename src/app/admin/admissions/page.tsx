import PageHeading from "@/components/page-heading";
import { getCurrentSchool } from "@/lib/current-school";
import AdmissionsManager from "./admissions-manager";

type Props = { searchParams: Promise<{ error?: string }> };
export default async function AdmissionsPage({ searchParams }: Props) {
  const { error: conversionError } = await searchParams;
  const { supabase, school } = await getCurrentSchool();
  const [applicationsResult, armsResult, classesResult, programmesResult, levelsResult, sessionsResult, termsResult] = await Promise.all([
    supabase.from("admission_applications").select("id, application_reference, first_name, middle_name, surname, email, phone, application_status, applied_at, decision_notes, applied_class_arm_id, applied_programme_id, applied_academic_level_id, academic_session_id, academic_term_id").eq("school_id", school.id).order("applied_at", { ascending: false }).limit(100),
    supabase.from("class_arms").select("id, name, class_id").eq("school_id", school.id).order("name"),
    supabase.from("school_classes").select("id, name").eq("school_id", school.id),
    supabase.from("academic_programmes").select("id, name, is_active").eq("school_id", school.id).order("name"),
    supabase.from("academic_levels").select("id, name, programme_id, is_active").eq("school_id", school.id).order("sequence").order("name"),
    supabase.from("academic_sessions").select("id, name, is_active").eq("school_id", school.id).order("starts_on", { ascending: false }),
    supabase.from("academic_terms").select("id, name, academic_session_id, is_active").eq("school_id", school.id).order("starts_on"),
  ]);
  const failed = [applicationsResult, armsResult, classesResult, programmesResult, levelsResult, sessionsResult, termsResult].some((result) => result.error);
  if (failed) {
    console.error("Unable to load admissions data", [applicationsResult.error?.message, armsResult.error?.message, classesResult.error?.message].filter(Boolean));
    return <><PageHeading title="Admissions" description={`Manage applications and admission decisions for ${school.name}.`}/><div role="alert" className="card p-5 text-sm text-rose-700">Admissions data could not be loaded. Refresh and try again.</div></>;
  }
  const arms = (armsResult.data ?? []).map((item) => ({ ...item, class_name: classesResult.data?.find((c) => c.id === item.class_id)?.name ?? "Class" }));
  return <><PageHeading title="Admissions" description={`Review applications and convert accepted applicants into student records for ${school.name}.`}/>{conversionError && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">The application could not be converted. Confirm it is accepted and try again.</p>}<AdmissionsManager applications={applicationsResult.data ?? []} institutionType={school.institution_type} arms={arms} programmes={programmesResult.data ?? []} levels={levelsResult.data ?? []} sessions={sessionsResult.data ?? []} terms={termsResult.data ?? []}/></>;
}
