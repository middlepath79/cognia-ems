import type { SupabaseClient } from "@supabase/supabase-js";
import type { InstitutionStatus, WorkspaceMembership } from "@/lib/auth-routing";
import { matchesStaffCategoryForRole } from "@/lib/staff-utils";

export async function loadWorkspaceMemberships(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ memberships: WorkspaceMembership[]; error: Error | null }> {
  const { data: rows, error: membershipError } = await supabase
    .from("school_memberships")
    .select("school_id,role,status")
    .eq("user_id", userId);
  if (membershipError) return { memberships: [], error: membershipError };
  if (!rows?.length) return { memberships: [], error: null };

  const schoolIds = [...new Set(rows.map((membership) => membership.school_id))];
  const [{ data: schools, error: schoolError }, { data: staffRecords, error: staffError }] = await Promise.all([
    supabase.from("schools").select("id,status").in("id", schoolIds),
    supabase
      .from("staff_records")
      .select("school_id,staff_category")
      .eq("user_id", userId)
      .eq("account_status", "active")
      .in("school_id", schoolIds),
  ]);
  if (schoolError || staffError) {
    return {
      memberships: [],
      error: schoolError ?? staffError,
    };
  }

  const schoolStatus = new Map(
    (schools ?? []).map((school) => [
      school.id,
      (["active", "pending_review", "suspended"].includes(school.status)
        ? school.status
        : "suspended") as InstitutionStatus,
    ]),
  );
  const activeStaffCategories = new Map<string, Set<string>>();
  for (const record of staffRecords ?? []) {
    const categories = activeStaffCategories.get(record.school_id) ?? new Set<string>();
    categories.add(record.staff_category);
    activeStaffCategories.set(record.school_id, categories);
  }
  return {
    memberships: rows.map((membership) => ({
      schoolId: membership.school_id,
      role: membership.role,
      membershipStatus: membership.status,
      institutionStatus: schoolStatus.get(membership.school_id) ?? "suspended",
      hasActiveStaffRecord: [...(activeStaffCategories.get(membership.school_id) ?? [])]
        .some((category) => matchesStaffCategoryForRole(membership.role, category)),
    })),
    error: null,
  };
}
