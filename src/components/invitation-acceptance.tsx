"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function InvitationAcceptance({ token }: { token: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const accepted = useRef(false);

  const acceptInvite = useCallback(async () => {
    if (!token || accepted.current) return;
    accepted.current = true;
    setBusy(true);
    const bytes = new TextEncoder().encode(token);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const tokenHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const { data: schoolId, error: acceptError } = await supabase.rpc("accept_school_invitation", { invite_token_hash: tokenHash });
    if (acceptError || !schoolId) {
      accepted.current = false;
      setError("This invitation is invalid or expired, or does not match your confirmed email account.");
      setBusy(false);
      return;
    }
    const { data: memberships } = await supabase.from("school_memberships").select("role").eq("school_id", schoolId).eq("status", "active").limit(1);
    const role = memberships?.[0]?.role;
    router.replace(role === "school_admin" ? "/admin" : role === "staff" || role === "teacher" ? "/staff/dashboard" : "/portal");
  }, [router, supabase, token]);

  useEffect(() => {
    if (!token) return;
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void acceptInvite();
    });
  }, [acceptInvite, supabase.auth, token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    if (register) {
      const next = `/accept-invitation?token=${encodeURIComponent(token)}`;
      const { data, error: signupError } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
      if (signupError) setError(signupError.message);
      else if (data.session) await acceptInvite();
      else setMessage("Check your email to verify your account, then return using this invitation link.");
      setBusy(false);
      return;
    }
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) {
      setError(loginError.message);
      setBusy(false);
    } else {
      await acceptInvite();
    }
  }

  return <main className="grid min-h-screen place-items-center bg-slate-50 p-5"><section className="card w-full max-w-md p-7 sm:p-9"><Link href="/" className="text-xs font-bold tracking-widest text-indigo-700">COGNIA</Link><h1 className="mt-5 text-2xl font-bold text-slate-900">Accept institution invitation</h1><p className="mt-2 text-sm leading-6 text-slate-500">Sign in or create an account using the email address this invitation was sent to.</p>{!token && <p role="alert" className="mt-4 text-sm text-rose-700">This invitation link is missing its token.</p>}<form className="mt-6 space-y-4" onSubmit={handleSubmit}><label className="block text-sm font-medium text-slate-700">Email<input type="email" name="email" required autoComplete="email" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"/></label><label className="block text-sm font-medium text-slate-700">Password<input type="password" name="password" minLength={8} required autoComplete={register ? "new-password" : "current-password"} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"/></label>{error && <p role="alert" className="text-sm text-rose-700">{error}</p>}{message && <p role="status" className="text-sm text-emerald-700">{message}</p>}<button disabled={busy || !token} className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Please wait…" : register ? "Create account and accept" : "Sign in and accept"}</button></form><button type="button" onClick={() => setRegister(!register)} className="mt-5 text-sm text-indigo-700">{register ? "Already have an account? Sign in" : "Need an account? Create one"}</button></section></main>;
}
