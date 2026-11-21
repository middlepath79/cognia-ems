import test from "node:test";
import assert from "node:assert/strict";
import { calculateGpa, calculatePeriodResult } from "./academic-calculations.ts";

test("calculates configured CA and examination contributions without combining raw marks", () => {
  const result = calculatePeriodResult({
    caMaximum: 40,
    examinationMaximum: 60,
    ca: [{ score: 80, maximum: 100, weight: 100, published: true }],
    examinations: [{ score: 70, maximum: 100, weight: 60, published: true }],
    bands: [{ minimum: 0, maximum: 49.99, grade: "F" }, { minimum: 50, maximum: 100, grade: "P" }],
  });
  assert.equal(result.complete, true);
  assert.equal(result.caContribution, 32);
  assert.equal(result.examinationContribution, 42);
  assert.equal(result.finalTotal, 74);
  assert.equal(result.grade?.grade, "P");
});

test("leaves final results incomplete when a published component is missing", () => {
  const result = calculatePeriodResult({
    caMaximum: 35,
    examinationMaximum: 65,
    ca: [{ score: null, maximum: 20, weight: 35, published: false }],
    examinations: [{ score: 70, maximum: 100, weight: 65, published: true }],
    bands: [{ minimum: 0, maximum: 100, grade: "P" }],
  });
  assert.equal(result.complete, false);
  assert.equal(result.finalTotal, null);
  assert.ok(result.missing.includes("continuous_assessment"));
});

test("uses configured GPA scale values with credit weighting", () => {
  const gpa = calculateGpa({
    method: "credit_weighted",
    repeatPolicy: "all_attempts",
    attempts: [
      { courseId: "A", periodOrder: 1, credits: 3, gradePoint: 4, published: true },
      { courseId: "B", periodOrder: 1, credits: 1, gradePoint: 2, published: true },
    ],
  });
  assert.equal(gpa.qualityPoints, 14);
  assert.equal(gpa.credits, 4);
  assert.equal(gpa.gpa, 3.5);
});

test("applies latest and highest retake policies while retaining excluded attempts", () => {
  const attempts = [
    { courseId: "A", periodOrder: 1, credits: 3, gradePoint: 2, published: true },
    { courseId: "A", periodOrder: 2, credits: 3, gradePoint: 4, published: true },
  ];
  assert.equal(calculateGpa({ attempts, method: "credit_weighted", repeatPolicy: "latest" }).gpa, 4);
  assert.equal(calculateGpa({ attempts, method: "credit_weighted", repeatPolicy: "highest" }).gpa, 4);
  assert.equal(calculateGpa({ attempts, method: "credit_weighted", repeatPolicy: "latest" }).excluded.length, 1);
});

test("handles multiple CA components with weight normalization", () => {
  const result = calculatePeriodResult({
    caMaximum: 40,
    examinationMaximum: 60,
    ca: [
      { score: 80, maximum: 100, weight: 60, published: true },
      { score: 70, maximum: 100, weight: 40, published: true },
    ],
    examinations: [{ score: 75, maximum: 100, weight: 60, published: true }],
    bands: [{ minimum: 0, maximum: 49.99, grade: "F" }, { minimum: 50, maximum: 100, grade: "P" }],
  });
  assert.equal(result.complete, true);
  // (80/100)*60 + (70/100)*40 = 48 + 28 = 76; normalized: 76/100 * 40 = 30.4
  assert.equal(result.caContribution, 30.4);
});

test("handles missing examination configuration when no exams provided", () => {
  const result = calculatePeriodResult({
    caMaximum: 40,
    examinationMaximum: 60,
    ca: [{ score: 80, maximum: 100, weight: 100, published: true }],
    examinations: [],
    bands: [{ minimum: 0, maximum: 49.99, grade: "F" }, { minimum: 50, maximum: 100, grade: "P" }],
  });
  assert.equal(result.complete, false);
  assert.ok(result.missing.some((m) => m.includes("examination")));
});

test("course_average GPA method calculates correctly", () => {
  const gpa = calculateGpa({
    method: "course_average",
    repeatPolicy: "all_attempts",
    attempts: [
      { courseId: "A", periodOrder: 1, credits: 3, gradePoint: 4, published: true },
      { courseId: "B", periodOrder: 1, credits: 1, gradePoint: 2, published: true },
    ],
  });
  assert.equal(gpa.gpa, 3);
  assert.equal(gpa.credits, 4);
});

test("exclude_repeats policy excludes all but first attempt", () => {
  const attempts = [
    { courseId: "A", periodOrder: 1, credits: 3, gradePoint: 2, published: true },
    { courseId: "A", periodOrder: 2, credits: 3, gradePoint: 4, published: true },
    { courseId: "A", periodOrder: 3, credits: 3, gradePoint: 3, published: true },
  ];
  const gpa = calculateGpa({ attempts, method: "credit_weighted", repeatPolicy: "exclude_repeats" });
  assert.equal(gpa.gpa, 2);
  assert.equal(gpa.excluded.length, 2);
});

test("handles null grade points by excluding attempts", () => {
  const attempts = [
    { courseId: "A", periodOrder: 1, credits: 3, gradePoint: 4, published: true },
    { courseId: "B", periodOrder: 1, credits: 3, gradePoint: null, published: true },
  ];
  const gpa = calculateGpa({ attempts, method: "credit_weighted", repeatPolicy: "all_attempts" });
  assert.equal(gpa.gpa, 4);
  assert.equal(gpa.excluded.length, 1);
  assert.ok(gpa.excluded[0].reason.includes("grade point"));
});

test("handles zero or negative credits by excluding attempts", () => {
  const attempts = [
    { courseId: "A", periodOrder: 1, credits: 3, gradePoint: 4, published: true },
    { courseId: "B", periodOrder: 1, credits: 0, gradePoint: 3, published: true },
    { courseId: "C", periodOrder: 1, credits: -1, gradePoint: 2, published: true },
  ];
  const gpa = calculateGpa({ attempts, method: "credit_weighted", repeatPolicy: "all_attempts" });
  assert.equal(gpa.gpa, 4);
  assert.equal(gpa.excluded.length, 2);
});

test("returns null GPA when no valid attempts remain", () => {
  const attempts = [
    { courseId: "A", periodOrder: 1, credits: 3, gradePoint: null, published: true },
  ];
  const gpa = calculateGpa({ attempts, method: "credit_weighted", repeatPolicy: "all_attempts" });
  assert.equal(gpa.gpa, null);
  assert.equal(gpa.credits, 0);
});

test("handles partial CA publication with multiple components", () => {
  const result = calculatePeriodResult({
    caMaximum: 40,
    examinationMaximum: 60,
    ca: [
      { score: 80, maximum: 100, weight: 50, published: true },
      { score: 70, maximum: 100, weight: 50, published: false },
    ],
    examinations: [{ score: 75, maximum: 100, weight: 60, published: true }],
    bands: [{ minimum: 0, maximum: 49.99, grade: "F" }, { minimum: 50, maximum: 100, grade: "P" }],
  });
  assert.equal(result.complete, false);
  assert.ok(result.missing.includes("continuous_assessment"));
});

test("handles multiple grade bands correctly", () => {
  const result = calculatePeriodResult({
    caMaximum: 40,
    examinationMaximum: 60,
    ca: [{ score: 90, maximum: 100, weight: 100, published: true }],
    examinations: [{ score: 95, maximum: 100, weight: 60, published: true }],
    bands: [
      { minimum: 0, maximum: 39.99, grade: "F", description: "Fail" },
      { minimum: 40, maximum: 49.99, grade: "D", description: "Poor" },
      { minimum: 50, maximum: 59.99, grade: "C", description: "Average" },
      { minimum: 60, maximum: 69.99, grade: "B", description: "Good" },
      { minimum: 70, maximum: 100, grade: "A", description: "Excellent" },
    ],
  });
  assert.equal(result.complete, true);
  assert.equal(result.grade?.grade, "A");
  assert.equal(result.grade?.description, "Excellent");
});

test("reports missing grade band when final total falls outside configured ranges", () => {
  const result = calculatePeriodResult({
    caMaximum: 40,
    examinationMaximum: 60,
    ca: [{ score: 80, maximum: 100, weight: 100, published: true }],
    examinations: [{ score: 70, maximum: 100, weight: 60, published: true }],
    bands: [{ minimum: 0, maximum: 50, grade: "F" }],
  });
  assert.equal(result.complete, false);
  assert.ok(result.missing.some((m) => m.includes("grade_band")));
});

test("examination weights must match configured maximum when normalizeWeights=false", () => {
  const result = calculatePeriodResult({
    caMaximum: 40,
    examinationMaximum: 60,
    ca: [{ score: 80, maximum: 100, weight: 100, published: true }],
    examinations: [{ score: 70, maximum: 100, weight: 50, published: true }],
    bands: [{ minimum: 0, maximum: 100, grade: "P" }],
  });
  assert.equal(result.complete, false);
  assert.ok(result.missing.includes("examination"));
});