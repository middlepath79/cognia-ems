import Link from "next/link";
import { redirect } from "next/navigation";
import PageHeading from "@/components/page-heading";
import { createClient } from "@/lib/supabase/server";
import { approveSchoolAction } from "./actions";

export default async function PlatformPage({ searchParams }: { searchParams: Promise<{ error?: string; approved?: string }> }) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (typeof claims?.claims.sub !== "string") redirect("/login");

  const { data: platformAdministrator, error: platformAdministratorError } = await supabase
    .from("platform_administrators")
    .select("user_id")
    .eq("user_id", claims.claims.sub)
    .maybeSingle();
  if (platformAdministratorError) {
    console.error("Unable to verify platform administrator access", platformAdministratorError.message);
    return <main className="grid min-h-screen place-items-center bg-slate-50 p-5"><section className="card max-w-lg p-8 text-center"><h1 className="text-xl font-bold text-slate-900">Platform access could not be verified</h1><p className="mt-3 text-sm leading-6 text-slate-500">We couldn’t verify your platform permissions. Please try again. If the problem continues, contact support.</p></section></main>;
  }
  if (!platformAdministrator) redirect("/admin");

  const [{ data: schools }, { data: schoolAdminMemberships }] = await Promise.all([
    supabase.from("schools").select("id, name, slug, institution_type, status, created_at").eq("status", "pending_review").order("created_at", { ascending: true }),
    supabase.from("school_memberships").select("id").eq("user_id", claims.claims.sub).eq("role", "school_admin").eq("status", "active").limit(1),
  ]);
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-slate-50 p-5 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <PageHeading title="Platform administration" description="Review institution onboarding and manage platform access." />
          {schoolAdminMemberships?.length ? (
            <Link href="/admin" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700">
              Switch to School Administration
            </Link>
          ) : null}
        </div>
        <section className="card overflow-hidden">
          <div className="border-b border-slate-100 p-5"><h2 className="text-sm font-bold text-slate-800">Institutions awaiting review</h2></div>
          {params.approved && <p role="status" className="m-5 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">School approved successfully.</p>}
          {params.error && <p role="alert" className="m-5 rounded-md bg-rose-50 p-3 text-sm text-rose-800">{params.error === "authorization-check" ? "Platform administrator access could not be verified. Please retry or contact support." : "The review could not be completed."}</p>}
          {schools?.length ? (
            <div className="divide-y divide-slate-100">
              {schools.map((school) => (
                <div key={school.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{school.name}</h3>
                    <p className="mt-1 text-xs text-slate-500">{school.institution_type.replaceAll("_", " ")} · {school.slug} · Submitted {new Date(school.created_at).toLocaleDateString()}</p>
                  </div>
                  <form action={approveSchoolAction}>
                    <input type="hidden" name="schoolId" value={school.id} />
                    <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Approve institution</button>
                  </form>
                </div>
              ))}
            </div>
          ) : <p className="p-5 text-sm text-slate-500">No schools are awaiting review.</p>}
        </section>
      </div>
    </main>
  );
}
