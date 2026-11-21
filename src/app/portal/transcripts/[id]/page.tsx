import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TranscriptDocument from "@/components/transcript-document";

export default async function StudentTranscriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (typeof claims?.claims.sub !== "string") redirect("/login");
  const { data, error } = await supabase.from("transcript_issues").select("id,transcript_reference,transcript_snapshot,voided_at").eq("id", id).maybeSingle();
  if (error || !data) return <main className="mx-auto max-w-4xl p-6"><p className="card p-6 text-sm text-rose-700">Transcript unavailable or you do not own this record.</p></main>;
  return <><div className="mx-auto max-w-5xl p-4 print:hidden"><Link href="/portal" className="text-sm font-semibold text-indigo-700">← Student portal</Link></div><TranscriptDocument snapshot={data.transcript_snapshot} reference={data.transcript_reference} voided={Boolean(data.voided_at)} /></>;
}
