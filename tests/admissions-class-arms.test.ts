import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

test("admissions and student placement use the class-arms schema columns that exist", () => {
  const admissions = fs.readFileSync(
    path.join(process.cwd(), "src", "app", "admin", "admissions", "page.tsx"),
    "utf8",
  );
  const studentProfile = fs.readFileSync(
    path.join(process.cwd(), "src", "app", "admin", "students", "[id]", "page.tsx"),
    "utf8",
  );
  const foundation = fs.readFileSync(
    path.join(process.cwd(), "supabase", "migrations", "20261119095321_academic_management_foundation.sql"),
    "utf8",
  );

  assert.doesNotMatch(admissions, /class_arms".*is_active/i);
  assert.doesNotMatch(studentProfile, /class_arms".*is_active/i);
  assert.doesNotMatch(foundation.slice(foundation.indexOf("create table public.class_arms"), foundation.indexOf("create unique index class_arms_class_name_idx")), /is_active/i);
  assert.match(admissions, /supabase\.from\("class_arms"\)\.select\("id, name, class_id"\)/);
  assert.match(studentProfile, /supabase\.from\("class_arms"\)\.select\("id, name, class_id"\)/);
});
