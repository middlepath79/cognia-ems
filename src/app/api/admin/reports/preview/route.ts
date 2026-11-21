import { createClient } from "@/lib/supabase/server";
import { getCurrentSchool } from "@/lib/current-school";
import { NextRequest, NextResponse } from "next/server";

const TABLE_MAP: Record<string, string> = {
  students: "students",
  enrolments: "student_enrolments",
  assessments: "assessments",
  examination_results: "examination_results",
  final_results: "final_results",
  attendance_records: "attendance_records",
  transcript_issues: "transcript_issues",
  academic_sessions: "academic_sessions",
  classes: "classes",
};

const FIELD_MAP: Record<string, string[]> = {
  students: ["id", "student_number", "first_name", "middle_name", "surname", "date_of_birth", "gender", "admission_date", "status", "school_id"],
  enrolments: ["id", "student_id", "class_id", "session_id", "term_id", "is_active", "school_id"],
  assessments: ["id", "subject_id", "class_id", "assessment_type", "title", "maximum_score", "weight", "published", "school_id"],
  examination_results: ["id", "examination_id", "student_id", "score", "maximum_score", "graded_at", "published", "school_id"],
  final_results: ["id", "student_id", "subject_id", "session_id", "term_id", "ca_contribution", "examination_contribution", "final_total", "grade", "grade_point", "school_id"],
  attendance_records: ["id", "student_id", "class_id", "session_id", "term_id", "status", "recorded_at", "school_id"],
  transcript_issues: ["id", "student_id", "transcript_reference", "transcript_snapshot", "issued_at", "voided_at", "school_id"],
  academic_sessions: ["id", "name", "start_date", "end_date", "is_active", "school_id"],
  classes: ["id", "name", "level", "arm", "programme_id", "department_id", "faculty_id", "school_id"],
};

export async function POST(request: NextRequest) {
  try {
    const { school } = await getCurrentSchool();
    const supabase = await createClient();
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid report request" }, { status: 400 });
    }
    const payload = body as { dataSource?: unknown; columns?: unknown; filters?: unknown; sortBy?: unknown; limit?: unknown };
    const { dataSource, columns, filters, sortBy, limit = 100 } = payload;

    if (typeof dataSource !== "string") return NextResponse.json({ error: "Invalid data source" }, { status: 400 });
    const table = TABLE_MAP[dataSource];
    if (!table) {
      return NextResponse.json({ error: "Invalid data source" }, { status: 400 });
    }

    const allowedFields = FIELD_MAP[dataSource] || [];
    if (!Array.isArray(columns) || !Array.isArray(filters) || !Array.isArray(sortBy)) {
      return NextResponse.json({ error: "Invalid report configuration" }, { status: 400 });
    }
    if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 1000) {
      return NextResponse.json({ error: "Preview limit must be between 1 and 1000" }, { status: 400 });
    }
    const selectFields = columns.length > 0
      ? columns.filter((c): c is string => typeof c === "string" && allowedFields.includes(c))
      : allowedFields;

    let query = supabase.from(table).select(selectFields.join(",")).eq("school_id", school.id).limit(limit);

    if (filters.length > 0) {
      for (const filter of filters as { field: string; operator: string; value: string }[]) {
        if (!allowedFields.includes(filter.field)) continue;
        const { field, operator, value } = filter;
        if (value === "" && operator !== "is_null" && operator !== "is_not_null") continue;

        switch (operator) {
          case "eq":
            query = query.eq(field, value);
            break;
          case "neq":
            query = query.neq(field, value);
            break;
          case "gt":
            query = query.gt(field, value);
            break;
          case "gte":
            query = query.gte(field, value);
            break;
          case "lt":
            query = query.lt(field, value);
            break;
          case "lte":
            query = query.lte(field, value);
            break;
          case "like":
            query = query.like(field, `%${value}%`);
            break;
          case "ilike":
            query = query.ilike(field, `%${value}%`);
            break;
          case "in":
            const values = value.split(",").map((v: string) => v.trim());
            query = query.in(field, values);
            break;
        }
      }
    }

    if (sortBy.length > 0) {
      for (const sort of sortBy as { field: string; direction: "asc" | "desc" }[]) {
        if (allowedFields.includes(sort.field)) {
          query = query.order(sort.field, { ascending: sort.direction === "asc" });
        }
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error("Report preview error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rows: data || [] });
  } catch (error) {
    console.error("Report preview failed:", error);
    return NextResponse.json({ error: "Failed to generate preview" }, { status: 500 });
  }
}