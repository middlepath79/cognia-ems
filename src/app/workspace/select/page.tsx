import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadWorkspaceMemberships } from "@/lib/workspace-memberships";
import { resolveWorkspaceDestination } from "@/lib/auth-routing";
import { selectWorkspaceAction } from "./actions";
import CogniaBrand from "@/components/brand/cognia-brand";

export default async function WorkspaceSelectorPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (typeof userId !== "string") redirect("/login");

  const [{ data: platformAdmin, error: platformError }, result] = await Promise.all([
    supabase.from("platform_administrators").select("user_id").eq("user_id", userId).maybeSingle(),
    loadWorkspaceMemberships(supabase, userId),
  ]);
  if (platformError || result.error) {
    console.error("Unable to load workspace choices", {
      platformError: platformError?.message,
      membershipError: result.error?.message,
    });
    redirect("/access-denied");
  }
  if (platformAdmin) redirect("/platform");

  const choices = result.memberships.filter(
    (membership) => resolveWorkspaceDestination([membership], undefined) !== "/access-denied",
  );
  if (!choices.length) redirect("/access-denied");
  if (new Set(choices.map((choice) => choice.schoolId)).size === 1) {
    redirect(resolveWorkspaceDestination(choices, undefined));
  }

  const schoolIds = [...new Set(choices.map((choice) => choice.schoolId))];
  const { data: schools, error } = await supabase.from("schools").select("id,name").in("id", schoolIds);
  if (error) {
    console.error("Unable to load institution names for workspace selection", error.message);
    redirect("/access-denied");
  }
  const names = new Map((schools ?? []).map((school) => [school.id, school.name]));

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-5">
      <section className="card w-full max-w-lg p-7 sm:p-9">
        <CogniaBrand href="/" subtitle="Workspaces" size="standard" className="mb-6" />
        <h1 className="mt-3 text-2xl font-bold text-slate-900">Choose an institution</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Select the institution and role workspace you want to open.</p>
        <div className="mt-6 space-y-3">
          {choices.map((choice) => (
            <form action={selectWorkspaceAction} key={`${choice.schoolId}-${choice.role}`}>
              <input type="hidden" name="schoolId" value={choice.schoolId} />
              <button className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-left hover:border-indigo-300">
                <span className="block text-sm font-semibold text-slate-800">{names.get(choice.schoolId) ?? "Institution"}</span>
                <span className="mt-1 block text-xs capitalize text-slate-500">{choice.role.replaceAll("_", " ")}</span>
              </button>
            </form>
          ))}
        </div>
      </section>
    </main>
  );
}
