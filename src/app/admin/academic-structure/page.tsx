import PageHeading from "@/components/page-heading";
import { getCurrentSchool } from "@/lib/current-school";
import StructureManager from "./structure-manager";

export default async function AcademicStructurePage() {
  const { supabase, school } = await getCurrentSchool();
  const [facultyResult, departmentResult, programmeResult, levelResult, subjectResult] = await Promise.all([
    supabase.from("faculties").select("id, name, code, is_active").eq("school_id", school.id).order("name"),
    supabase.from("departments").select("id, faculty_id, name, description, is_active").eq("school_id", school.id).order("name"),
    supabase.from("academic_programmes").select("id, department_id, name, code, award, duration_years, is_active").eq("school_id", school.id).order("name"),
    supabase.from("academic_levels").select("id, programme_id, name, sequence, is_active").eq("school_id", school.id).order("sequence").order("name"),
    supabase.from("subjects").select("id, department_id, programme_id, academic_level_id, academic_period_name, name, code, credit_units, description, is_active").eq("school_id", school.id).order("name"),
  ]);
  const firstError = facultyResult.error ?? departmentResult.error ?? programmeResult.error ?? levelResult.error ?? subjectResult.error;
  if (firstError) {
    console.error("Unable to load institution academic structure", firstError.message);
    return <><PageHeading title="Academic Structure" description={`Manage faculties, departments, programmes, levels and curriculum for ${school.name}.`}/><div className="card p-5 text-sm text-rose-700" role="alert">Academic structure could not be loaded. Refresh the page or contact support if this continues.</div></>;
  }
  return <>
    <PageHeading title="Academic Structure" description={`Manage faculties, departments, programmes, levels and curriculum for ${school.name}.`}/>
    <StructureManager
      faculties={facultyResult.data ?? []}
      departments={departmentResult.data ?? []}
      programmes={programmeResult.data ?? []}
      levels={levelResult.data ?? []}
      subjects={subjectResult.data ?? []}
      institutionType={school.institution_type}
      periodLabel={school.academic_period_label}
    />
  </>;
}
