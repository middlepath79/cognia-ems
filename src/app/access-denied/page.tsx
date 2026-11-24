import Link from "next/link";
import CogniaBrand from "@/components/brand/cognia-brand";

export default function AccessDeniedPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-5">
      <section role="alert" className="card max-w-lg p-8 text-center">
        <CogniaBrand href="/" tagline size="standard" className="mb-6 justify-center" />
        <h1 className="text-xl font-bold text-slate-900">Workspace access unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          We could not verify an active institution membership and workspace for this account.
          Contact your institution administrator or sign in with another account.
        </p>
        <Link href="/login" className="mt-5 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
          Return to sign in
        </Link>
      </section>
    </main>
  );
}
