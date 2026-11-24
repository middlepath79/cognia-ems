import PageHeading from "@/components/page-heading";
import CsvDownload from "@/components/csv-download";
import { getCurrentSchool } from "@/lib/current-school";
import { createStaffCsv, getInvitationDisplayStatus } from "@/lib/staff-utils";
import StaffDirectoryClient from "./staff-directory";
import type { StaffDirectoryFilters, StaffDirectoryStats, StaffInvitation, StaffRecord } from "./staff-types";

type StaffSearchParams = StaffDirectoryFilters;
type QueryError = { code?: string; message?: string } | null;

const setupErrorCodes = new Set(["22P02", "42P01", "42703", "42704", "42883", "PGRST202", "PGRST204", "PGRST205"]);
const employmentStatuses = new Set(["active", "on_leave", "suspended", "terminated", "retired"]);
const staffCategories = new Set(["teaching", "non_teaching"]);
const accountStatuses = new Set(["pending", "invited", "active", "deactivated"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function StaffLoadError({ setupRequired }: { setupRequired: boolean }) {
  return (
    <>
      <PageHeading title="Staff Management" description="Manage employee records and secure account access for your institution." />
      <div role="alert" className="card p-5 text-sm text-rose-700">
        {setupRequired
          ? "The Staff schema is unavailable in the connected Supabase project. Apply the COGNIA staff migrations after the academic foundation, then refresh the API schema cache."
          : "Staff data could not be loaded. Verify your administrator access, then refresh the page."}
      </div>
    </>
  );
}

function hasSetupError(errors: QueryError[]): boolean {
  return errors.some((error) => setupErrorCodes.has(error?.code ?? ""));
}

function countValue(error: QueryError, count: number | null, metric: string): number | null {
  if (!error) return count ?? 0;
  console.error("Unable to load staff summary metric", {
    metric,
    code: error.code,
    message: error.message?.slice(0, 300),
  });
  return null;
}

export default async function StaffPage({ searchParams }: { searchParams: Promise<StaffSearchParams> }) {
  const { school, supabase } = await getCurrentSchool();
  const params = await searchParams;
  const searchTerm = (params.q ?? "").trim().slice(0, 100).replace(/[%*(),"]/g, "").replaceAll("\\", "");
  const status = employmentStatuses.has(params.status ?? "") ? params.status : "";
  const category = staffCategories.has(params.category ?? "") ? params.category : "";
  const account = accountStatuses.has(params.account ?? "") ? params.account : "";
  const department = uuid.test(params.department ?? "") ? params.department : "";
  const sortParam = params.sort ?? "";
  const sort = ["name", "employee_number", "employment_status", "joined_on"].includes(sortParam) ? sortParam : "name";
  const direction = params.direction === "desc" ? "desc" : "asc";

  let staffQuery = supabase
    .from("staff_records")
    .select("id,user_id,employee_number,first_name,middle_name,surname,email,phone,profile_photo_url,gender,date_of_birth,address,staff_category,department_id,designation,employment_status,employment_type,joined_on,reporting_manager_id,account_status,notes")
    .eq("school_id", school.id)
    .order(sort === "name" ? "surname" : sort, { ascending: direction === "asc", nullsFirst: false })
    .order("first_name")
    .order("id");
  if (status) staffQuery = staffQuery.eq("employment_status", status);
  if (category) staffQuery = staffQuery.eq("staff_category", category);
  if (account) staffQuery = staffQuery.eq("account_status", account);
  if (department) staffQuery = staffQuery.eq("department_id", department);
  if (searchTerm) {
    const pattern = `%${searchTerm}%`;
    staffQuery = staffQuery.or(
      `first_name.ilike.${pattern},middle_name.ilike.${pattern},surname.ilike.${pattern},employee_number.ilike.${pattern},email.ilike.${pattern}`,
    );
  }

  const now = new Date().toISOString();
  const queryPromise = Promise.all([
    staffQuery,
    supabase.from("departments").select("id,name").eq("school_id", school.id).order("name"),
    supabase
      .from("school_memberships")
      .select("user_id,role,status")
      .eq("school_id", school.id)
      .in("status", ["active", "suspended"])
      .in("role", ["teacher", "staff", "school_admin"])
      .order("role"),
    supabase.from("staff_records").select("id,first_name,surname,employee_number").eq("school_id", school.id).order("surname").order("first_name"),
    supabase.from("staff_records").select("id", { count: "exact", head: true }).eq("school_id", school.id),
    supabase.from("staff_records").select("id", { count: "exact", head: true }).eq("school_id", school.id).eq("staff_category", "teaching"),
    supabase.from("staff_records").select("id", { count: "exact", head: true }).eq("school_id", school.id).eq("staff_category", "non_teaching"),
    supabase.from("staff_records").select("id", { count: "exact", head: true }).eq("school_id", school.id).eq("employment_status", "active"),
    supabase
      .from("school_invitations")
      .select("id", { count: "exact", head: true })
      .eq("school_id", school.id)
      .in("role", ["teacher", "staff"])
      .eq("status", "pending")
      .gt("expires_at", now),
  ]);
  let queryResults: Awaited<typeof queryPromise>;
  try {
    queryResults = await queryPromise;
  } catch (error) {
    console.error("Unable to load staff directory", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return <StaffLoadError setupRequired={false} />;
  }

  const [
    { data: staff, error: staffError },
    { data: departments, error: departmentError },
    { data: memberships, error: membershipError },
    { data: managerRows, error: managerError },
    { count: totalCount, error: totalError },
    { count: teachingCount, error: teachingError },
    { count: nonTeachingCount, error: nonTeachingError },
    { count: activeCount, error: activeError },
    { count: pendingInvitationCount, error: invitationCountError },
  ] = queryResults;
  const errors = [staffError, departmentError, membershipError, managerError];
  if (errors.some(Boolean)) {
    console.error("Unable to load staff directory", {
      staffErrorCode: staffError?.code,
      staffErrorMessage: staffError?.message?.slice(0, 300),
      departmentErrorCode: departmentError?.code,
      departmentErrorMessage: departmentError?.message?.slice(0, 300),
      membershipErrorCode: membershipError?.code,
      membershipErrorMessage: membershipError?.message?.slice(0, 300),
      managerErrorCode: managerError?.code,
      managerErrorMessage: managerError?.message?.slice(0, 300),
    });
    return <StaffLoadError setupRequired={hasSetupError(errors)} />;
  }

  const memberIds = [...new Set((memberships ?? []).map((membership) => membership.user_id))];
  const { data: profiles, error: profilesError } = memberIds.length
    ? await supabase.from("profiles").select("id,display_name").in("id", memberIds)
    : { data: [], error: null };
  if (profilesError) {
    console.error("Unable to load staff account names", {
      code: profilesError.code,
      message: profilesError.message?.slice(0, 300),
    });
    return <StaffLoadError setupRequired={false} />;
  }
  const profileNames = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
  const membershipOptions = (memberships ?? []).map((membership) => ({
    ...membership,
    display_name: profileNames.get(membership.user_id) || null,
  }));

  const rows = (staff ?? []) as StaffRecord[];
  const activeMembershipIds = new Set(
    membershipOptions
      .filter((membership) => membership.status === "active")
      .map((membership) => membership.user_id),
  );
  const emails = [...new Set(rows.map((record) => record.email?.toLowerCase()).filter((email): email is string => Boolean(email)))];
  let invitations: StaffInvitation[] = [];
  if (emails.length) {
    const { data: invitationRows, error: invitationsError } = await supabase
      .from("school_invitations")
      .select("email,role,status,expires_at,created_at")
      .eq("school_id", school.id)
      .in("role", ["teacher", "staff"])
      .in("email", emails)
      .order("created_at", { ascending: false });
    if (invitationsError) {
      console.error("Unable to load staff invitation statuses", {
        code: invitationsError.code,
        message: invitationsError.message?.slice(0, 300),
      });
    } else {
      invitations = (invitationRows ?? []).map((invitation) => ({
        ...invitation,
        status: getInvitationDisplayStatus(invitation.status, invitation.expires_at),
      }));
    }
  }

  const stats: StaffDirectoryStats = {
    total: countValue(totalError, totalCount, "total staff"),
    teaching: countValue(teachingError, teachingCount, "teaching staff"),
    nonTeaching: countValue(nonTeachingError, nonTeachingCount, "non-teaching staff"),
    active: countValue(activeError, activeCount, "active staff"),
    pendingInvitations: countValue(invitationCountError, pendingInvitationCount, "pending staff invitations"),
  };
  const csv = createStaffCsv(rows);
  return (
    <>
      <PageHeading
        title="Staff Management"
        description={`Manage employee records, employment details and secure account access for ${school.name}.`}
        action={<CsvDownload csv={csv} filename={`staff-directory-${new Date().toISOString().slice(0, 10)}.csv`} disabled={!rows.length} />}
      />
      <StaffDirectoryClient
        staff={rows}
        departments={departments ?? []}
        memberships={membershipOptions}
        managers={managerRows ?? []}
        invitations={invitations}
        stats={stats}
        filters={{ q: searchTerm, status, department, category, account, sort, direction }}
      />
    </>
  );
}
