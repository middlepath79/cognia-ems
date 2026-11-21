import PageHeading from "@/components/page-heading";
import ClassManager from "./class-manager";
import { getCurrentSchool } from "@/lib/current-school";

export default async function ClassesPage() {
  const { supabase, school } = await getCurrentSchool();
  const [{ data: classes, error: classError }, { data: arms, error: armError }] = await Promise.all([
    supabase.from("school_classes").select("id, name, sort_order").eq("school_id", school.id).order("sort_order").order("name"),
    supabase.from("class_arms").select("id, class_id, name, sort_order").eq("school_id", school.id).order("sort_order").order("name"),
  ]);
  if (classError || armError) {
    console.error("Unable to load school classes", { classError: classError?.message, armError: armError?.message });
    return <><PageHeading title="Classes & Arms" description="Manage the class structure for this school."/><div role="alert" className="card p-5 text-sm text-rose-700">Class data could not be loaded. Refresh the page or contact support if this continues.</div></>;
  }
  const classRows = (classes ?? []).map((schoolClass) => ({ ...schoolClass, arms: (arms ?? []).filter((arm) => arm.class_id === schoolClass.id) }));
  return <><PageHeading title="Classes & Arms" description={`Define classes and class arms for ${school.name}.`}/><ClassManager classes={classRows}/></>;
}
