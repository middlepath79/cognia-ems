import PageHeading from "@/components/page-heading";
import { getCurrentSchool } from "@/lib/current-school";
import SettingsManager from "./settings-manager";

export default async function SettingsPage(){
 const {school,supabase}=await getCurrentSchool();
 const {data:preferences}=await supabase.from("institution_preferences").select("*").eq("school_id",school.id).maybeSingle();
 return <><PageHeading title="Institution settings" description={`Configure ${school.name} profile and institution-specific preferences.`}/><SettingsManager school={school} preferences={preferences}/></>;
}
