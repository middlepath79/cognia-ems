import PageHeading from "@/components/page-heading";
import SubjectManager from "./subject-manager";
import { getCurrentSchool } from "@/lib/current-school";

export default async function SubjectsPage() {
  const { supabase, school } = await getCurrentSchool();
  const [{ data: departments, error: departmentError }, { data: subjects, error: subjectError }] = await Promise.all([
    supabase.from("departments").select("id, name, description").eq("school_id", school.id).order("name"),
    supabase.from("subjects").select("id, department_id, name, code, description").eq("school_id", school.id).order("name"),
  ]);
  if (departmentError || subjectError) {
    console.error("Unable to load school subjects", { departmentError: departmentError?.message, subjectError: subjectError?.message });
    return <><PageHeading title="Subjects & Departments" description={`Organise the curriculum for ${school.name}.`}/><div role="alert" className="card p-5 text-sm text-rose-700">Subject data could not be loaded. Refresh the page or contact support if this continues.</div></>;
  }
  return <><PageHeading title="Subjects & Departments" description={`Organise the curriculum for ${school.name}.`}/><SubjectManager departments={departments ?? []} subjects={subjects ?? []}/></>;
}
