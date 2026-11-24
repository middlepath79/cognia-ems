import Link from "next/link";
import CogniaBrand from "@/components/brand/cognia-brand";

export default function NotFound() {
  return <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-center"><div><CogniaBrand href="/" tagline size="standard" className="mb-6 justify-center" /><p className="text-sm font-bold text-brand">404</p><h1 className="mt-2 text-2xl font-bold text-slate-900">Page not found</h1><p className="mt-2 text-sm text-slate-500">The page you requested does not exist.</p><Link href="/" className="mt-5 inline-block rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white">Back to workspace</Link></div></main>;
}
