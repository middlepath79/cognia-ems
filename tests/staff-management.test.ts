import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import {
  canAccessTeacherWorkspace,
  createStaffCsv,
  getInvitationDisplayStatus,
  validateStaffContact,
  validateStaffForm,
  type StaffFormValues,
} from "../src/lib/staff-utils";

function readSqlFunction(sql: string, name: string): string {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1, `Expected ${name} function in migration`);
  const next = sql.indexOf("\ncreate or replace function public.", start + 1);
  return sql.slice(start, next === -1 ? sql.length : next);
}

const validStaffForm: StaffFormValues = {
  id: "",
  userId: "123e4567-e89b-12d3-a456-426614174000",
  employeeNumber: "EMP-42",
  firstName: "Ada",
  middleName: "",
  surname: "Lovelace",
  email: "ada@example.edu",
  phone: "",
  profilePhotoUrl: "",
  gender: "",
  dateOfBirth: "",
  address: "",
  staffCategory: "teaching",
  reportingManagerId: "",
  departmentId: "",
  designation: "Lecturer",
  employmentStatus: "active",
  employmentType: "full_time",
  joinedOn: "2026-01-31",
  notes: "",
};

test("staff form validation accepts valid records and rejects malformed dates and identifiers", () => {
  assert.equal(validateStaffForm(validStaffForm), null);
  assert.match(validateStaffForm({ ...validStaffForm, joinedOn: "2026-02-30" }) ?? "", /joining date/i);
  assert.match(validateStaffForm({ ...validStaffForm, dateOfBirth: "2026-02-30" }) ?? "", /date of birth/i);
  assert.match(validateStaffForm({ ...validStaffForm, userId: "not-a-uuid" }) ?? "", /membership/i);
  assert.match(validateStaffForm({ ...validStaffForm, id: "invalid" }) ?? "", /profile is invalid/i);
});

test("staff profile can be created before account activation and validates invitation data", () => {
  const pendingStaff = { ...validStaffForm, userId: "" };
  assert.equal(validateStaffForm(pendingStaff), null);
  assert.match(validateStaffForm({ ...pendingStaff, email: "" }) ?? "", /email address/i);
  assert.match(validateStaffForm({ ...pendingStaff, staffCategory: "administrator" }) ?? "", /category/i);
  assert.match(validateStaffForm({ ...pendingStaff, profilePhotoUrl: "javascript:alert(1)" }) ?? "", /HTTP or HTTPS/i);
});

test("staff contact edits validate only the approved personal fields", () => {
  assert.equal(validateStaffContact({ phone: "+1 555 0100", address: "12 Example Road" }), null);
  assert.match(validateStaffContact({ phone: "x".repeat(41), address: "" }) ?? "", /40 characters/i);
  assert.match(validateStaffContact({ phone: "", address: "x".repeat(501) }) ?? "", /500 characters/i);
  assert.match(validateStaffContact({ phone: "", address: `Home${"\u0000"}` }) ?? "", /control characters/i);
});

test("non-teaching staff are not granted teacher workspace access", () => {
  assert.equal(canAccessTeacherWorkspace("teacher"), true);
  assert.equal(canAccessTeacherWorkspace("staff"), false);
  assert.equal(canAccessTeacherWorkspace("school_admin"), false);
});

test("staff invitation status shows pending, accepted, revoked and elapsed invitations accurately", () => {
  const now = Date.parse("2026-11-21T18:00:00.000Z");
  assert.equal(getInvitationDisplayStatus("pending", "2026-11-22T18:00:00.000Z", now), "pending");
  assert.equal(getInvitationDisplayStatus("pending", "2026-11-20T18:00:00.000Z", now), "expired");
  assert.equal(getInvitationDisplayStatus("accepted", "2026-11-20T18:00:00.000Z", now), "accepted");
  assert.equal(getInvitationDisplayStatus("revoked", "2026-11-22T18:00:00.000Z", now), "revoked");
});

test("staff form validation enforces server-side lengths, email, and employee number rules", () => {
  assert.match(validateStaffForm({ ...validStaffForm, employeeNumber: " " }) ?? "", /employee number/i);
  assert.match(validateStaffForm({ ...validStaffForm, employeeNumber: `EMP${"\u0000"}` }) ?? "", /employee number/i);
  assert.match(validateStaffForm({ ...validStaffForm, email: "not-an-email" }) ?? "", /valid email/i);
  assert.match(validateStaffForm({ ...validStaffForm, departmentId: "not-a-uuid" }) ?? "", /department/i);
});

test("staff CSV quotes fields and neutralizes spreadsheet formulas", () => {
  const csv = createStaffCsv([{
    employee_number: "EMP-1",
    first_name: "=CMD()",
    middle_name: null,
    surname: "Staff, Example",
    email: "person@example.edu",
    phone: null,
    employment_status: "active",
    employment_type: "full_time",
    designation: "Lecturer",
    staff_category: "teaching",
    account_status: "active",
  }]);

  assert.equal(
    csv,
    "Employee,Name,Email,Phone,Status,Type,Designation,Category,Account\r\nEMP-1,\"'=CMD() Staff, Example\",person@example.edu,,active,full_time,Lecturer,teaching,active",
  );
});

test("staff migration requires matching tenant keys and restricts writes to eligible admins", () => {
  const migration = fs.readFileSync(
    path.join(process.cwd(), "supabase", "migrations", "20261120140000_cognia_staff_fees_settings.sql"),
    "utf8",
  );
  const academic = fs.readFileSync(
    path.join(process.cwd(), "supabase", "migrations", "20261119095321_academic_management_foundation.sql"),
    "utf8",
  );
  const institution = fs.readFileSync(
    path.join(process.cwd(), "supabase", "migrations", "20261119142326_cognia_institution_and_academic_models.sql"),
    "utf8",
  );
  const students = fs.readFileSync(
    path.join(process.cwd(), "supabase", "migrations", "20261119165748_cognia_student_information.sql"),
    "utf8",
  );
  const manualDeployment = fs.readFileSync(
    path.join(process.cwd(), "supabase", "deployments", "20261120140000_staff_fees_settings_manual.sql"),
    "utf8",
  );

  assert.match(academic, /unique \(id, school_id\)/i);
  assert.match(institution, /unique \(id, school_id\)/i);
  assert.match(students, /unique \(id, school_id, academic_session_id\)/i);
  assert.match(students, /unique \(id, school_id, programme_id\)/i);
  assert.match(migration, /foreign key \(department_id, school_id\) references public\.departments\(id,school_id\)/i);
  assert.match(migration, /foreign key \(academic_level_id, school_id, programme_id\) references public\.academic_levels\(id,school_id,programme_id\)/i);
  assert.match(migration, /staff_records_admin_insert[\s\S]*created_by=\(select auth\.uid\(\)\)/i);
  assert.match(migration, /staff_records_admin_update[\s\S]*m\.status='active'[\s\S]*m\.role in \('teacher','school_admin'\)/i);
  assert.match(migration, /revoke delete on public\.staff_records from authenticated/i);
  assert.doesNotMatch(migration, /create policy staff_records_admin_manage/i);
  assert.match(manualDeployment, /staff_records_admin_insert[\s\S]*created_by=\(select auth\.uid\(\)\)/i);
  assert.match(manualDeployment, /staff_records_admin_update[\s\S]*m\.status='active'[\s\S]*m\.role in \('teacher','school_admin'\)/i);
  assert.match(manualDeployment, /staff_records_school_employee_number_ci_idx/i);
  for (const sql of [migration, manualDeployment]) {
    assert.match(sql, /conrelid = any\(array\[[\s\S]*'public\.fee_payments'::regclass[\s\S]*\]\)\s*order by table_name, conname/i);
    assert.match(sql, /when paid_total>0 then 'partially_paid'[\s\S]*else 'issued'/i);
    assert.match(sql, /invoice_status='draft'[\s\S]*end if/i);
    assert.doesNotMatch(sql, /if\b[^\n]*then\b[^\n]*;\s*end;/i);
    assert.doesNotMatch(sql, /conrelid::regclass::text in\s*\(/i);
    assert.doesNotMatch(sql, /order by table_name::text, conname/i);
  }
});

test("staff portal migration links invitations and limits staff profile access", () => {
  const roleMigration = fs.readFileSync(
    path.join(process.cwd(), "supabase", "migrations", "20261120160000_cognia_staff_role.sql"),
    "utf8",
  );
  const portalMigration = fs.readFileSync(
    path.join(process.cwd(), "supabase", "migrations", "20261120170000_cognia_staff_portal.sql"),
    "utf8",
  );

  assert.match(roleMigration, /add value if not exists 'staff'/i);
  assert.match(portalMigration, /staff_records_self_read[\s\S]*user_id = \(select auth\.uid\(\)\)[\s\S]*account_status = 'active'/i);
  assert.match(portalMigration, /set_staff_account_status[\s\S]*has_school_role\(target_school_id, array\['school_admin'\]/i);
  assert.match(portalMigration, /set status = case when target_status = 'active'[\s\S]*'suspended'::public\.membership_status/i);
});

test("Staff Portal deployment preserves the membership FK and alters policies in place", () => {
  const portalMigration = fs.readFileSync(
    path.join(process.cwd(), "supabase", "migrations", "20261120170000_cognia_staff_portal.sql"),
    "utf8",
  );
  const setup = fs.readFileSync(path.join(process.cwd(), "supabase", "SETUP.md"), "utf8");

  assert.match(portalMigration, /foreign key from migration 1400 is missing/i);
  assert.match(portalMigration, /c\.confrelid = 'public\.school_memberships'::regclass[\s\S]*c\.confdeltype = 'c'[\s\S]*unnest\(c\.conkey\)[\s\S]*array\['school_id', 'user_id'\]::text\[\][\s\S]*unnest\(c\.confkey\)/i);
  assert.doesNotMatch(portalMigration, /pg_get_constraintdef\(c\.oid\)\s+like\s+'FOREIGN KEY \(school_id, user_id\) REFERENCES public\.school_memberships/i);
  assert.match(portalMigration, /alter policy invitations_insert_school_admin/i);
  assert.match(portalMigration, /alter policy staff_records_admin_insert/i);
  assert.match(portalMigration, /alter policy staff_records_admin_update/i);
  assert.doesNotMatch(portalMigration, /drop policy/i);
  assert.doesNotMatch(portalMigration, /drop constraint staff_records_school_id_user_id_fkey/i);
  assert.match(portalMigration, /known four-role whitelist[\s\S]*drop constraint school_invitations_role_check/i);
  assert.match(portalMigration, /for update[\s\S]*get diagnostics affected_rows = row_count/i);

  assert.ok(setup.indexOf("20261120140000_cognia_staff_fees_settings.sql") < setup.indexOf("20261120160000_cognia_staff_role.sql"));
  assert.ok(setup.indexOf("20261120160000_cognia_staff_role.sql") < setup.indexOf("20261120170000_cognia_staff_portal.sql"));
  assert.ok(setup.indexOf("20261120170000_cognia_staff_portal.sql") < setup.indexOf("20261120180000_staff_invitation_and_contact_security.sql"));
  assert.match(setup, /Skip `20261120150000_cognia_staff_fees_setup_correction\.sql`/);
});

test("staff migrations use the granted private role helper in pinned security-definer functions", () => {
  const helperMigration = fs.readFileSync(
    path.join(process.cwd(), "supabase", "migrations", "20261119002724_private_rls_helpers.sql"),
    "utf8",
  );
  const portalMigration = fs.readFileSync(
    path.join(process.cwd(), "supabase", "migrations", "20261120170000_cognia_staff_portal.sql"),
    "utf8",
  );
  const securityMigration = fs.readFileSync(
    path.join(process.cwd(), "supabase", "migrations", "20261120180000_staff_invitation_and_contact_security.sql"),
    "utf8",
  );

  assert.match(helperMigration, /create function private\.has_school_role\(target_school_id uuid, allowed_roles public\.app_role\[\]\)\s+returns boolean language sql stable security definer set search_path = ''/i);
  assert.match(helperMigration, /m\.user_id=\(select auth\.uid\(\)\).*?m\.status='active'.*?m\.role=any\(allowed_roles\)/i);
  assert.match(helperMigration, /grant usage on schema private to authenticated/i);
  assert.match(helperMigration, /revoke all on function private\.is_school_member\(uuid\), private\.is_platform_super_admin\(\), private\.has_school_role\(uuid,public\.app_role\[\]\) from public, anon/i);
  assert.match(helperMigration, /grant execute on function private\.is_school_member\(uuid\), private\.is_platform_super_admin\(\), private\.has_school_role\(uuid,public\.app_role\[\]\) to authenticated/i);

  for (const migration of [portalMigration, securityMigration]) {
    assert.doesNotMatch(migration, /public\.has_school_role/i);
    assert.match(migration, /private\.has_school_role/i);
  }
  assert.match(portalMigration, /revoke all on function public\.create_school_invitation\(uuid, text, public\.app_role, text\) from public, anon, authenticated/i);
  assert.match(portalMigration, /revoke all on function public\.accept_school_invitation\(text\) from public, anon, authenticated/i);
  assert.match(securityMigration, /grant execute on function public\.create_school_invitation\(uuid, text, public\.app_role, text\) to authenticated/i);
  assert.match(securityMigration, /grant execute on function public\.accept_school_invitation\(text\) to authenticated/i);

  const functions = [
    [portalMigration, "set_staff_account_status"],
    [portalMigration, "get_staff_reporting_manager"],
    [securityMigration, "create_school_invitation"],
    [securityMigration, "accept_school_invitation"],
    [securityMigration, "update_my_staff_contact"],
  ] as const;
  for (const [migration, name] of functions) {
    assert.match(readSqlFunction(migration, name), /security definer\s+set search_path = ''/i);
  }

  for (const name of ["create_school_invitation", "accept_school_invitation", "update_my_staff_contact"]) {
    const functionSql = readSqlFunction(securityMigration, name);
    const end = securityMigration.indexOf("$$;", securityMigration.indexOf(functionSql)) + 3;
    const nextStatement = securityMigration.slice(end, end + 180);
    assert.match(nextStatement, new RegExp(`revoke all on function public\\.${name}`, "i"));
  }
});

test("invitation acceptance requires verified matching email and rejects expired or reused tokens", () => {
  const migration = fs.readFileSync(
    path.join(process.cwd(), "supabase", "migrations", "20261120180000_staff_invitation_and_contact_security.sql"),
    "utf8",
  );
  const accept = readSqlFunction(migration, "accept_school_invitation");

  assert.match(accept, /auth\.uid\(\).*?is null/i);
  assert.match(accept, /u\.email_confirmed_at/);
  assert.match(accept, /email_confirmed_at is null/);
  assert.match(accept, /invite\.email is distinct from signed_in_email/i);
  assert.match(accept, /i\.status = 'pending'[\s\S]*i\.expires_at > now\(\)[\s\S]*for update/i);
  assert.match(accept, /set status = 'accepted'[\s\S]*where id = invite\.id\s+and status = 'pending'/i);
  assert.match(accept, /get diagnostics linked_rows = row_count;\s*if linked_rows <> 1 then\s*raise exception 'The invitation could not be marked as accepted'/i);
});

test("teacher and staff invitations require a same-school pending profile before membership creation", () => {
  const migration = fs.readFileSync(
    path.join(process.cwd(), "supabase", "migrations", "20261120180000_staff_invitation_and_contact_security.sql"),
    "utf8",
  );
  const create = readSqlFunction(migration, "create_school_invitation");
  const accept = readSqlFunction(migration, "accept_school_invitation");

  assert.match(create, /invite_role in \('teacher', 'staff'\)[\s\S]*sr\.school_id = target_school_id[\s\S]*lower\(trim\(sr\.email\)\) = normalized_email[\s\S]*sr\.user_id is null[\s\S]*sr\.account_status in \('pending', 'invited'\)/i);
  assert.match(create, /invite_role = 'teacher' and sr\.staff_category = 'teaching'/i);
  assert.match(accept, /sr\.school_id = invite\.school_id[\s\S]*lower\(trim\(sr\.email\)\) = signed_in_email[\s\S]*sr\.user_id is null[\s\S]*sr\.account_status = 'invited'/i);
  assert.match(accept, /invite\.role = 'teacher' and sr\.staff_category = 'teaching'/i);
  assert.ok(accept.indexOf("into pending_staff_record_id") < accept.indexOf("insert into public.school_memberships"));
  assert.match(accept, /set user_id = \(select auth\.uid\(\)\),\s*account_status = 'active'[\s\S]*where id = pending_staff_record_id[\s\S]*school_id = invite\.school_id/i);
  assert.match(accept, /get diagnostics linked_rows = row_count;\s*if linked_rows <> 1 then\s*raise exception 'The staff profile could not be linked/i);
  assert.match(accept, /insert into public\.school_memberships \(school_id, user_id, role, status\)\s+values \(invite\.school_id, \(select auth\.uid\(\)\), invite\.role, 'active'\)/i);
});

test("staff contact RPC updates only phone and address for the caller's active staff profile", () => {
  const migration = fs.readFileSync(
    path.join(process.cwd(), "supabase", "migrations", "20261120180000_staff_invitation_and_contact_security.sql"),
    "utf8",
  );
  const portalMigration = fs.readFileSync(
    path.join(process.cwd(), "supabase", "migrations", "20261120170000_cognia_staff_portal.sql"),
    "utf8",
  );
  const updateContact = readSqlFunction(migration, "update_my_staff_contact");
  const invitationActions = fs.readFileSync(
    path.join(process.cwd(), "src", "app", "admin", "invitations", "actions.ts"),
    "utf8",
  );

  assert.match(updateContact, /sr\.school_id = target_school_id[\s\S]*sr\.user_id = \(select auth\.uid\(\)\)[\s\S]*sr\.account_status = 'active'/i);
  assert.match(updateContact, /has_school_role\(staff_school_id, array\['teacher', 'staff'\]/i);
  const updatedColumns = updateContact.match(/update public\.staff_records\s+set([\s\S]*?)\s+where/i)?.[1] ?? "";
  assert.match(updatedColumns, /phone = nullif\(trim\(target_phone\), ''\),\s*address = nullif\(trim\(target_address\), ''\)/i);
  assert.doesNotMatch(updatedColumns, /employee_number|department_id|designation|employment_status|employment_type|staff_category|school_id|user_id|role/i);
  assert.doesNotMatch(portalMigration, /create policy staff_records_self_update/i);
  assert.match(invitationActions, /randomBytes\(32\)/);
  assert.match(invitationActions, /createHash\("sha256"\)/);
  assert.match(invitationActions, /school_admin/);
});
