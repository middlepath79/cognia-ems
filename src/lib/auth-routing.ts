export type WorkspaceRole = "school_admin" | "teacher" | "staff" | "student" | "parent";
export type InstitutionStatus = "active" | "pending_review" | "suspended";

export type WorkspaceMembership = {
  schoolId: string;
  role: string;
  membershipStatus: string;
  institutionStatus: InstitutionStatus;
  hasActiveStaffRecord: boolean;
};

function destinationFor(membership: WorkspaceMembership): string | null {
  if (membership.membershipStatus !== "active") return null;
  if (membership.role === "school_admin") {
    if (membership.institutionStatus === "active") return "/admin";
    if (membership.institutionStatus === "pending_review") return "/school-review";
    return null;
  }
  if (
    (membership.role === "teacher" || membership.role === "staff") &&
    membership.institutionStatus === "active" &&
    membership.hasActiveStaffRecord
  ) {
    return "/staff";
  }
  if (
    (membership.role === "student" || membership.role === "parent") &&
    membership.institutionStatus === "active"
  ) {
    return "/portal";
  }
  return null;
}

export function resolveWorkspaceDestination(
  memberships: WorkspaceMembership[],
  selectedSchoolId: string | undefined,
): string {
  const eligible = memberships.flatMap((membership) => {
    const destination = destinationFor(membership);
    return destination ? [{ membership, destination }] : [];
  });

  if (selectedSchoolId) {
    const selected = eligible.find((item) => item.membership.schoolId === selectedSchoolId);
    if (selected) return selected.destination;
  }
  if (!eligible.length) return "/access-denied";

  const schoolIds = new Set(eligible.map(({ membership }) => membership.schoolId));
  if (schoolIds.size > 1) return "/workspace/select";
  return eligible[0].destination;
}

export function getSafeInternalPath(requestedPath: string | null, baseUrl: string): string | null {
  if (!requestedPath || !requestedPath.startsWith("/") || requestedPath.startsWith("//")) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(requestedPath)) return null;

  const pathOnly = requestedPath.split(/[?#]/, 1)[0];
  if (/%(?:2f|5c)/i.test(pathOnly)) return null;

  try {
    const base = new URL(baseUrl);
    const destination = new URL(requestedPath, base);
    if (destination.origin !== base.origin || !destination.pathname.startsWith("/")) return null;
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return null;
  }
}
