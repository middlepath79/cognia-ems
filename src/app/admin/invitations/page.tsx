import PageHeading from "@/components/page-heading";
import { getCurrentSchool } from "@/lib/current-school";
import { getInvitationDisplayStatus } from "@/lib/staff-utils";
import InviteForm from "./invite-form";
import RevokeInvitationButton from "./revoke-button";

export default async function InvitationsPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const params = await searchParams;
  const { supabase, school } = await getCurrentSchool();
  const [{ data: schools }, { data: invitations }] = await Promise.all([
    supabase.from("schools").select("id, name").eq("id", school.id),
    supabase.from("school_invitations").select("id, school_id, email, role, status, expires_at, created_at").eq("school_id", school.id).order("created_at", { ascending: false }),
  ]);

  const defaultRole = params.role === "teacher" || params.role === "staff" ? params.role : undefined;
  return (
    <>
      <PageHeading title="Invitations" description={`Secure school access invitations for ${school.name}.`} />
      <InviteForm schools={schools ?? []} defaultRole={defaultRole} />
      <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(16,24,40,.025)]">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-sm font-bold text-slate-900">Invitation history</h2>
          <p className="mt-1 text-xs text-slate-500">Invitation links are shown only when created and are not recoverable from this history.</p>
        </div>
        {invitations?.length ? (
          <div className="divide-y divide-slate-100">
            {invitations.map((invite) => {
              const status = getInvitationDisplayStatus(invite.status, invite.expires_at);
              const tone = status === "accepted"
                ? "bg-emerald-50 text-emerald-700"
                : status === "pending"
                  ? "bg-amber-50 text-amber-800"
                  : ["expired", "revoked"].includes(status)
                    ? "bg-rose-50 text-rose-700"
                    : "bg-slate-100 text-slate-600";
              const canRevoke = invite.status === "pending" && new Date(invite.expires_at) > new Date();
              return (
                <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4" key={invite.id}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{invite.email}</p>
                    <p className="mt-1 text-xs capitalize text-slate-500">{invite.role.replaceAll("_", " ")}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${tone}`}>{status}</span>
                    <span className="text-xs text-slate-500">Expires {new Date(invite.expires_at).toLocaleDateString()}</span>
                    {canRevoke && <RevokeInvitationButton invitationId={invite.id} />}
                  </div>
                </div>
              );
            })}
          </div>
        ) : <p className="p-5 text-sm text-slate-500">No invitations have been created.</p>}
      </section>
    </>
  );
}
