import InvitationAcceptance from "@/components/invitation-acceptance";

export default async function AcceptInvitationPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return <InvitationAcceptance token={token} />;
}
