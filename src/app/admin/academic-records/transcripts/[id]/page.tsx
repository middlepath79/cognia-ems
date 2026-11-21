import Link from "next/link";
import { getCurrentAttendanceSchool } from "@/lib/attendance-workspace";
import TranscriptDocument from "@/components/transcript-document";

export default async function IssuedTranscriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, school } = await getCurrentAttendanceSchool();
  const { data, error } = await supabase.from("transcript_issues").select("id,transcript_reference,transcript_snapshot,voided_at").eq("id", id).eq("school_id", school.id).maybeSingle();
  if (error || !data) return <section className="card p-6 text-sm text-rose-700">Transcript unavailable in this institution or outside your access.</section>;
  return <><div className="mb-4 print:hidden"><Link href="/admin/academic-records" className="text-sm font-semibold text-indigo-700">← Academic records</Link></div><TranscriptDocument snapshot={data.transcript_snapshot} reference={data.transcript_reference} voided={Boolean(data.voided_at)} /></>;
}
