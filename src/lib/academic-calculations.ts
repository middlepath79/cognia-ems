export type GradeBand = {
  minimum: number;
  maximum: number;
  grade: string;
  description?: string;
  gradePoint?: number | null;
};

export type WeightedMark = {
  score: number | null;
  maximum: number;
  weight: number;
  published: boolean;
};

export type PeriodResult = {
  complete: boolean;
  caContribution: number | null;
  examinationContribution: number | null;
  finalTotal: number | null;
  grade: GradeBand | null;
  missing: string[];
};

export function calculatePeriodResult(input: {
  caMaximum: number;
  examinationMaximum: number;
  ca: WeightedMark[];
  examinations: WeightedMark[];
  bands: GradeBand[];
}): PeriodResult {
  const missing: string[] = [];
  const component = (name: string, maximum: number, marks: WeightedMark[], normalizeWeights: boolean) => {
    if (maximum === 0) return 0;
    const assignedWeight = marks.reduce((sum, item) => sum + item.weight, 0);
    const allPublished = marks.length > 0 && marks.every(item => item.published && item.score !== null);
    if (!allPublished || assignedWeight <= 0 || (!normalizeWeights && Math.abs(assignedWeight - maximum) > 0.0001)) {
      missing.push(name);
      return null;
    }
    const rawContribution = marks.reduce((sum, item) => sum + ((item.score as number) / item.maximum) * item.weight, 0);
    return normalizeWeights ? rawContribution / assignedWeight * maximum : rawContribution;
  };

  const caContribution = component("continuous_assessment", input.caMaximum, input.ca, true);
  const examinationContribution = component("examination", input.examinationMaximum, input.examinations, false);
  if (input.caMaximum === 0 && input.ca.length) missing.push("continuous_assessment_configuration");
  if (input.examinationMaximum === 0 && input.examinations.length) missing.push("examination_configuration");
  if (missing.length || caContribution === null || examinationContribution === null) {
    return { complete: false, caContribution: null, examinationContribution: null, finalTotal: null, grade: null, missing };
  }
  const finalTotal = caContribution + examinationContribution;
  const grade = input.bands.find(band => finalTotal >= band.minimum && finalTotal <= band.maximum) ?? null;
  if (!grade) missing.push("grade_band");
  return { complete: missing.length === 0, caContribution, examinationContribution, finalTotal, grade, missing };
}

export type GpaAttempt = {
  courseId: string;
  periodOrder: number;
  credits: number;
  gradePoint: number | null;
  published: boolean;
};

export type GpaSummary = { gpa: number | null; credits: number; qualityPoints: number; excluded: { courseId: string; reason: string }[] };

export function calculateGpa(input: {
  attempts: GpaAttempt[];
  method: "credit_weighted" | "course_average";
  repeatPolicy: "latest" | "highest" | "all_attempts" | "exclude_repeats";
}): GpaSummary {
  const excluded: GpaSummary["excluded"] = [];
  const published = input.attempts.filter(attempt => attempt.published);
  const groups = new Map<string, GpaAttempt[]>();
  for (const attempt of published) groups.set(attempt.courseId, [...(groups.get(attempt.courseId) ?? []), attempt]);
  const selected: GpaAttempt[] = [];
  for (const attempts of groups.values()) {
    attempts.sort((a, b) => a.periodOrder - b.periodOrder);
    if (input.repeatPolicy === "all_attempts") selected.push(...attempts);
    else if (input.repeatPolicy === "latest") selected.push(attempts[attempts.length - 1]);
    else if (input.repeatPolicy === "highest") selected.push([...attempts].sort((a, b) => (b.gradePoint ?? -1) - (a.gradePoint ?? -1))[0]);
    else selected.push(attempts[0]);
    if (input.repeatPolicy !== "all_attempts") {
      const keep = selected[selected.length - 1];
      for (const attempt of attempts) if (attempt !== keep) excluded.push({ courseId: attempt.courseId, reason: `Repeat excluded by ${input.repeatPolicy} policy` });
    }
  }
  let qualityPoints = 0;
  let credits = 0;
  let count = 0;
  for (const attempt of selected) {
    if (attempt.gradePoint === null) {
      excluded.push({ courseId: attempt.courseId, reason: "Published result has no configured grade point" });
      continue;
    }
    if (!Number.isFinite(attempt.credits) || attempt.credits <= 0) {
      excluded.push({ courseId: attempt.courseId, reason: "Course has no valid credit units" });
      continue;
    }
    qualityPoints += input.method === "credit_weighted" ? attempt.gradePoint * attempt.credits : attempt.gradePoint;
    credits += attempt.credits;
    count++;
  }
  const divisor = input.method === "credit_weighted" ? credits : count;
  return { gpa: divisor ? qualityPoints / divisor : null, credits, qualityPoints, excluded };
}
