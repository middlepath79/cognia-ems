"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "login" | "register" | "forgot" | "reset";

const content: Record<AuthMode, { title: string; description: string; submit: string }> = {
  login: { title: "Welcome back", description: "Sign in to your school workspace.", submit: "Sign in" },
  register: { title: "Create your account", description: "Start by creating your account, then register your institution.", submit: "Create account" },
  forgot: { title: "Reset your password", description: "We’ll email you a secure password reset link.", submit: "Send reset link" },
  reset: { title: "Choose a new password", description: "Enter a new password for your account.", submit: "Update password" },
};

export default function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    let result: { error: Error | null };

    if (mode === "login") {
      result = await supabase.auth.signInWithPassword({ email, password });
      if (!result.error) router.push("/admin");
    } else if (mode === "register") {
      const displayName = String(form.get("displayName") ?? "").trim();
      const origin = window.location.origin;
      const signUpResult = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
        },
      });
      result = signUpResult;
      if (!result.error) {
        if (signUpResult.data.session) router.push("/onboarding");
        else setMessage("Check your email to verify your account, then sign in to continue.");
      }
    } else if (mode === "forgot") {
      result = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (!result.error) setMessage("If an account exists for that email, a password reset link has been sent.");
    } else {
      result = await supabase.auth.updateUser({ password });
      if (!result.error) {
        setMessage("Your password has been updated. You can now sign in.");
        router.push("/login");
      }
    }

    if (result.error) setError(result.error.message);
    setBusy(false);
  }

  const details = content[mode];
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-5">
      <section className="card w-full max-w-md p-7 sm:p-9">
        <Link href="/" className="mb-7 flex items-center gap-3" aria-label="COGNIA home">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 font-bold text-white">C</span>
          <span><span className="block text-sm font-extrabold tracking-widest text-slate-900">COGNIA</span><span className="block text-[10px] tracking-[.2em] text-slate-500">EDUCATION MANAGEMENT</span></span>
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">{details.title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{details.description}</p>
        <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
          {mode === "register" && <label className="block text-sm font-medium text-slate-700">Full name<input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" name="displayName" autoComplete="name" required maxLength={120} /></label>}
          {mode !== "reset" && <label className="block text-sm font-medium text-slate-700">Email address<input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" name="email" type="email" autoComplete="email" required /></label>}
          {(mode === "login" || mode === "register") && <label className="block text-sm font-medium text-slate-700">Password<input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} /></label>}
          {mode === "reset" && <label className="block text-sm font-medium text-slate-700">New password<input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" name="password" type="password" autoComplete="new-password" required minLength={8} /></label>}
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
          <button className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60" disabled={busy}>
            {busy ? "Please wait…" : details.submit}
          </button>
        </form>
        <div className="mt-5 flex flex-wrap justify-between gap-3 text-sm text-indigo-700">
          {mode === "login" && <><Link href="/forgot-password">Forgot password?</Link><Link href="/register">Create account</Link></>}
          {mode === "register" && <Link href="/login">Already have an account? Sign in</Link>}
          {(mode === "forgot" || mode === "reset") && <Link href="/login">Back to sign in</Link>}
        </div>
      </section>
    </main>
  );
}
