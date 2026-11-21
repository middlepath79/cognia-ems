import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function SchoolReviewPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (typeof userId !== "string") redirect("/login");
  const { data: memberships } = await supabase.from("school_memberships").select("school_id").eq("user_id", userId).eq("role", "school_admin").eq("status", "active");
  const schoolIds = memberships?.map((membership) => membership.school_id) ?? [];
  if (!schoolIds.length) redirect("/onboarding");
  const { data: schools } = await supabase.from("schools").select("id, name, status").in("id", schoolIds);
  const pending = (schools ?? []).filter((school) => school.status === "pending_review");
  const active = (schools ?? []).filter((school) => school.status === "active");
  if (active.length) redirect("/admin");
  return <main className="grid min-h-screen place-items-center bg-slate-50 p-5"><section className="card w-full max-w-lg p-8 text-center"><p className="text-xs font-bold uppercase tracking-widest text-indigo-600">COGNIA · Institution review</p><h1 className="mt-3 text-2xl font-bold text-slate-900">Your institution is under review</h1><p className="mt-3 text-sm leading-6 text-slate-500">A Platform Super Administrator must approve your institution before its workspace becomes available.</p>{pending.length > 0 && <ul className="mt-5 space-y-2 text-sm font-semibold text-slate-700">{pending.map((school) => <li key={school.id}>{school.name}</li>)}</ul>}<form action="/auth/signout" method="post" className="mt-6"><button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Sign out</button></form></section></main>;
}
