import assert from "node:assert/strict";
import test from "node:test";
import { calculateGpa, calculatePeriodResult } from "../src/lib/academic-calculations";
import { calculateInvoiceBalance, validatePaymentAmount } from "../src/lib/fee-calculations";
import fs from "node:fs";
import path from "node:path";

test("calculatePeriodResult combines published CA and examination contributions", () => {
  const result = calculatePeriodResult({
    caMaximum: 40,
    examinationMaximum: 60,
    ca: [{ score: 30, maximum: 50, weight: 40, published: true }],
    examinations: [{ score: 48, maximum: 60, weight: 60, published: true }],
    bands: [{ minimum: 70, maximum: 100, grade: "A", gradePoint: 5 }],
  });
  assert.equal(result.complete, true);
  assert.equal(result.finalTotal, 72);
  assert.equal(result.grade?.grade, "A");
});

test("calculatePeriodResult marks unpublished components incomplete", () => {
  const result = calculatePeriodResult({
    caMaximum: 40,
    examinationMaximum: 60,
    ca: [{ score: null, maximum: 50, weight: 40, published: false }],
    examinations: [{ score: 48, maximum: 60, weight: 60, published: true }],
    bands: [{ minimum: 70, maximum: 100, grade: "A", gradePoint: 5 }],
  });
  assert.equal(result.complete, false);
  assert.deepEqual(result.missing, ["continuous_assessment"]);
});

test("calculateGpa applies credit weighting and repeat policy", () => {
  const result = calculateGpa({
    attempts: [
      { courseId: "math", periodOrder: 1, credits: 3, gradePoint: 4, published: true },
      { courseId: "math", periodOrder: 2, credits: 3, gradePoint: 5, published: true },
      { courseId: "english", periodOrder: 2, credits: 2, gradePoint: 3, published: true },
    ],
    method: "credit_weighted",
    repeatPolicy: "highest",
  });
  assert.equal(result.gpa, 4.2);
  assert.equal(result.credits, 5);
  assert.equal(result.qualityPoints, 21);
});

test("calculateGpa excludes attempts with missing grade points", () => {
  const result = calculateGpa({
    attempts: [{ courseId: "math", periodOrder: 1, credits: 3, gradePoint: null, published: true }],
    method: "credit_weighted",
    repeatPolicy: "latest",
  });
  assert.equal(result.gpa, null);
  assert.equal(result.credits, 0);
  assert.equal(result.excluded[0].reason, "Published result has no configured grade point");
});

test("calculateInvoiceBalance returns the remaining invoice amount", () => {
  assert.equal(calculateInvoiceBalance(1000, [250, 150]), 600);
  assert.equal(calculateInvoiceBalance(100, [60, 50]), 0);
});

test("validatePaymentAmount prevents overpayment", () => {
  assert.equal(validatePaymentAmount(1000, [250], 750), true);
  assert.equal(validatePaymentAmount(1000, [250], 751), false);
  assert.equal(validatePaymentAmount(1000, [250], 0), false);
});

test("staff and fee migration is additive and includes tenant-safe membership key", () => {
  const migrationPath = path.join(process.cwd(), "supabase", "migrations", "20261120140000_cognia_staff_fees_settings.sql");
  const sql = fs.readFileSync(migrationPath, "utf8");
  assert.match(sql, /school_memberships_school_user_unique/);
  assert.match(sql, /foreign key \(school_id, user_id\) references public\.school_memberships/);
  assert.match(sql, /enable row level security/);
  assert.doesNotMatch(sql, /drop table|drop policy|truncate|delete from/i);
});

test("manual staff deployment script fails fast and creates no destructive DDL", () => {
  const scriptPath = path.join(process.cwd(), "supabase", "deployments", "20261120140000_staff_fees_settings_manual.sql");
  const sql = fs.readFileSync(scriptPath, "utf8");
  assert.match(sql, /Prerequisite object/);
  assert.match(sql, /already exists/);
  assert.match(sql, /create table public\.staff_records/);
  assert.doesNotMatch(sql, /drop table|drop policy|truncate|delete from|alter table .* drop/i);
});
