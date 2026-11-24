import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { getSafeInternalPath, resolveWorkspaceDestination, type WorkspaceMembership } from "../src/lib/auth-routing";

const activeSchoolAdmin: WorkspaceMembership = {
  schoolId: "school-a",
  role: "school_admin",
  membershipStatus: "active",
  institutionStatus: "active",
  hasActiveStaffRecord: false,
};

test("auth callback accepts safe internal destinations and rejects redirect escapes", () => {
  const base = "https://cognia.example/auth/callback";
  const callback = fs.readFileSync(path.join(process.cwd(), "src", "app", "auth", "callback", "route.ts"), "utf8");
  assert.equal(getSafeInternalPath("/reset-password?from=mail#form", base), "/reset-password?from=mail#form");
  assert.equal(getSafeInternalPath(null, base), null);
  assert.equal(getSafeInternalPath("https://evil.example/path", base), null);
  assert.equal(getSafeInternalPath("//evil.example/path", base), null);
  assert.equal(getSafeInternalPath("/\\\\evil.example/path", base), null);
  assert.equal(getSafeInternalPath("/%2f%2fevil.example/path", base), null);
  assert.equal(getSafeInternalPath("/%5cevil.example/path", base), null);
  assert.match(callback, /if \(nextPath\) return NextResponse\.redirect[\s\S]*resolvePostLoginRoute\(\)/);
});

test("workspace routing requires an active verified role and handles multiple institutions explicitly", () => {
  assert.equal(resolveWorkspaceDestination([], undefined), "/access-denied");
  assert.equal(resolveWorkspaceDestination([{ ...activeSchoolAdmin, membershipStatus: "suspended" }], undefined), "/access-denied");
  assert.equal(resolveWorkspaceDestination([{ ...activeSchoolAdmin, institutionStatus: "suspended" }], undefined), "/access-denied");
  assert.equal(resolveWorkspaceDestination([{ ...activeSchoolAdmin, institutionStatus: "pending_review" }], undefined), "/school-review");
  assert.equal(
    resolveWorkspaceDestination([{ ...activeSchoolAdmin, role: "not_a_role" }], undefined),
    "/access-denied",
  );
  assert.equal(
    resolveWorkspaceDestination([{ ...activeSchoolAdmin, role: "teacher", hasActiveStaffRecord: false }], undefined),
    "/access-denied",
  );
  assert.equal(
    resolveWorkspaceDestination([{ ...activeSchoolAdmin, role: "teacher", hasActiveStaffRecord: true }], undefined),
    "/staff",
  );
  assert.equal(
    resolveWorkspaceDestination([{ ...activeSchoolAdmin, role: "student" }], undefined),
    "/portal",
  );
  assert.equal(
    resolveWorkspaceDestination([{ ...activeSchoolAdmin, role: "parent" }], undefined),
    "/portal",
  );
  assert.equal(resolveWorkspaceDestination([activeSchoolAdmin], "school-a"), "/admin");
  assert.equal(
    resolveWorkspaceDestination([activeSchoolAdmin, { ...activeSchoolAdmin, schoolId: "school-b", role: "student" }], undefined),
    "/workspace/select",
  );
  assert.equal(
    resolveWorkspaceDestination([activeSchoolAdmin, { ...activeSchoolAdmin, schoolId: "school-b", role: "student" }], "school-b"),
    "/portal",
  );
});

test("post-login routing trusts authenticated identities and rejects authorization lookup errors", () => {
  const resolver = fs.readFileSync(path.join(process.cwd(), "src", "lib", "post-login-route.ts"), "utf8");
  assert.match(resolver, /supabase\.auth\.getClaims\(\)/);
  assert.match(resolver, /claims\?\.claims\.sub/);
  assert.match(resolver, /from\("platform_administrators"\)[\s\S]*eq\("user_id", userId\)/);
  assert.match(resolver, /if \(platformError \|\| workspaceResult\.error\)[\s\S]*return "\/access-denied"/);
  assert.match(resolver, /if \(!workspaceResult\.memberships\.length\) return "\/onboarding"/);
});

test("institution onboarding creates its initial administrator atomically from the authenticated identity", () => {
  const migration = fs.readFileSync(
    path.join(process.cwd(), "supabase", "migrations", "20261119142743_cognia_default_academic_period_labels.sql"),
    "utf8",
  );
  const onboarding = migration.slice(
    migration.indexOf("create or replace function public.create_institution_onboarding"),
    migration.indexOf("revoke all on function public.create_institution_onboarding"),
  );
  assert.match(onboarding, /auth\.uid\(\).*?is null/i);
  assert.match(onboarding, /insert into public\.schools[\s\S]*returning id into new_school_id/i);
  assert.match(onboarding, /insert into public\.school_memberships[\s\S]*new_school_id[\s\S]*auth\.uid\(\)[\s\S]*'school_admin'[\s\S]*'active'/i);
  assert.match(onboarding, /insert into public\.school_onboarding[\s\S]*new_school_id[\s\S]*auth\.uid\(\)/i);
  const institutionMigration = fs.readFileSync(
    path.join(process.cwd(), "supabase", "migrations", "20261119142326_cognia_institution_and_academic_models.sql"),
    "utf8",
  );
  assert.match(institutionMigration, /grant execute on function public\.create_institution_onboarding\(text, text, text\) to authenticated/i);
  const foundation = fs.readFileSync(
    path.join(process.cwd(), "supabase", "migrations", "20261119000459_multi_school_foundation.sql"),
    "utf8",
  );
  assert.match(foundation, /slug text not null unique/i);
  assert.match(foundation, /unique \(school_id, user_id\)/i);
});

test("school-admin invitations require an existing administrator and acceptance cannot select a client role", () => {
  const invitationMigration = fs.readFileSync(
    path.join(process.cwd(), "supabase", "migrations", "20261120180000_staff_invitation_and_contact_security.sql"),
    "utf8",
  );
  const inviteStart = invitationMigration.indexOf("create or replace function public.create_school_invitation");
  const inviteEnd = invitationMigration.indexOf("\nrevoke all on function public.create_school_invitation", inviteStart);
  const createInvite = invitationMigration.slice(inviteStart, inviteEnd);
  const acceptanceStart = invitationMigration.indexOf("create or replace function public.accept_school_invitation");
  const acceptanceEnd = invitationMigration.indexOf("\nrevoke all on function public.accept_school_invitation", acceptanceStart);
  const acceptInvite = invitationMigration.slice(acceptanceStart, acceptanceEnd);
  assert.match(createInvite, /private\.has_school_role\(target_school_id, array\['school_admin'\]/i);
  assert.match(createInvite, /invite_role not in \('school_admin', 'teacher', 'staff', 'student', 'parent'\)/i);
  assert.match(acceptInvite, /email_confirmed_at is null/i);
  assert.match(acceptInvite, /invite\.email is distinct from signed_in_email/i);
  assert.match(acceptInvite, /i\.status = 'pending'[\s\S]*i\.expires_at > now\(\)[\s\S]*for update/i);
  assert.match(acceptInvite, /insert into public\.school_memberships[\s\S]*invite\.role/i);
  assert.doesNotMatch(acceptInvite, /target_role|requested_role|form_role/i);
});
