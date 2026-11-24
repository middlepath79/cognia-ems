import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { redirectToPostLoginRoute } from "@/lib/post-login-route";
import { createSchoolAction } from "./actions";
import CogniaBrand from "@/components/brand/cognia-brand";

const institutionTypes = [
  ["early_childhood", "Early childhood and daycare"], ["basic", "Nursery and primary"],
  ["secondary", "Junior or senior secondary"], ["technical_vocational", "Technical and vocational"],
  ["college", "College of education"], ["polytechnic", "Polytechnic"], ["monotechnic", "Monotechnic"],
  ["university", "University"], ["postgraduate", "Postgraduate school"],
  ["professional_research", "Professional or research institution"], ["mixed", "Multi-level institution"],
] as const;

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (typeof userId !== "string") redirect("/login");
  const { data: memberships } = await supabase
    .from("school_memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1);
  if (memberships?.length) {
    await redirectToPostLoginRoute();
  }

  const { error } = await searchParams;
  const errorMessage = error === "slug-taken"
    ? "That institution URL is already in use. Choose another one."
    : error === "invalid"
      ? "Enter a valid school name and URL."
      : error
        ? "We could not create the school. Please check your details and try again."
        : "";

  return (
    <main className="auth-page grid min-h-screen place-items-center bg-slate-50 p-5">
      <section className="auth-card card w-full max-w-lg p-7 sm:p-9">
        <CogniaBrand href="/" subtitle="Institution onboarding" size="standard" className="mb-6" />
        <h1 className="mt-3 text-2xl font-bold text-slate-900">Register your institution</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">You will receive institution administrator access while a Platform Super Administrator reviews the registration.</p>
        <form action={createSchoolAction} className="auth-form mt-7 space-y-4">
          <label className="block text-sm font-medium text-slate-700">Institution name<input name="schoolName" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" required minLength={2} maxLength={160} /></label>
          <label className="block text-sm font-medium text-slate-700">Institution category<select name="institutionType" defaultValue="basic" className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal" required>{institutionTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="block text-sm font-medium text-slate-700">Workspace URL<input name="schoolSlug" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={80} /><span className="mt-1 block text-xs text-slate-500">Use lowercase letters, numbers, and hyphens.</span></label>
          {errorMessage && <p role="alert" className="text-sm text-rose-700">{errorMessage}</p>}
          <button className="auth-submit w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">Submit institution for review</button>
        </form>
      </section>
    </main>
  );
}

