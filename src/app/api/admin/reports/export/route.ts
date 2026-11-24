import { createClient } from "@/lib/supabase/server";
import { getCurrentSchool } from "@/lib/current-school";
import { NextRequest, NextResponse } from "next/server";

type Filter = { field: string; operator: string; value: string };
type Sort = { field: string; direction: "asc" | "desc" };
type RowData = Record<string, unknown>;
type QueryBuilder = {
  eq: (field: string, value: unknown) => QueryBuilder;
  neq: (field: string, value: unknown) => QueryBuilder;
  gt: (field: string, value: unknown) => QueryBuilder;
  gte: (field: string, value: unknown) => QueryBuilder;
  lt: (field: string, value: unknown) => QueryBuilder;
  lte: (field: string, value: unknown) => QueryBuilder;
  like: (field: string, value: string) => QueryBuilder;
  ilike: (field: string, value: string) => QueryBuilder;
  in: (field: string, values: string[]) => QueryBuilder;
  is: (field: string, value: unknown) => QueryBuilder;
  order: (field: string, options: { ascending: boolean }) => QueryBuilder;
  range: (from: number, to: number) => QueryBuilder & PromiseLike<{ data: RowData[] | null; error: { message: string; code?: string } | null }>;
};

const TABLE_MAP: Record<string, string> = {
  students: "students",
  enrolments: "student_enrolments",
  assessments: "assessments",
  examination_results: "examination_results",
  final_results: "academic_period_results",
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
  final_results: ["id", "student_id", "subject_id", "academic_session_id", "academic_term_id", "ca_contribution", "examination_contribution", "final_total", "grade", "grade_point", "status", "school_id"],
  attendance_records: ["id", "student_id", "class_id", "session_id", "term_id", "status", "recorded_at", "school_id"],
  transcript_issues: ["id", "student_id", "transcript_reference", "transcript_snapshot", "issued_at", "voided_at", "school_id"],
  academic_sessions: ["id", "name", "start_date", "end_date", "is_active", "school_id"],
  classes: ["id", "name", "level", "arm", "programme_id", "department_id", "faculty_id", "school_id"],
};

function applyFilters(query: QueryBuilder, filters: Filter[], allowedFields: string[]): QueryBuilder {
  if (!filters || filters.length === 0) return query;

  for (const filter of filters) {
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
  return query;
}

function applySorting(query: QueryBuilder, sortBy: Sort[], allowedFields: string[]): QueryBuilder {
  if (!sortBy || sortBy.length === 0) return query;

  for (const sort of sortBy) {
    if (allowedFields.includes(sort.field)) {
      query = query.order(sort.field, { ascending: sort.direction === "asc" });
    }
  }
  return query;
}

async function fetchAllData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  selectFields: string,
  schoolId: string,
  filters: Filter[],
  sortBy: Sort[],
  allowedFields: string[]
): Promise<RowData[]> {
  const allData: RowData[] = [];
  let from = 0;
  const batchSize = 1000;

  while (true) {
    let query = supabase
      .from(table)
      .select(selectFields)
      .eq("school_id", schoolId) as unknown as QueryBuilder;

    query = applyFilters(query, filters, allowedFields);
    query = applySorting(query, sortBy, allowedFields);

    const pagedQuery = query.range(from, from + batchSize - 1);
    const { data, error } = await pagedQuery;

    if (error) throw error;
    if (!data || data.length === 0) break;

    allData.push(...(data as RowData[]));
    if (data.length < batchSize) break;
    from += batchSize;
  }

  return allData;
}

function generateCSV(data: RowData[], columns: string[]): string {
  if (data.length === 0) return columns.join(",") + "\n";

  const headers = columns.length > 0 ? columns : Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((header) => {
      const value = row[header];
      if (value === null || value === undefined) return "";
      let str = String(value);
      if (/^[=+@\t\r]/.test(str) || /^-/.test(str)) str = `'${str}`;
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}

function generateJSON(data: RowData[]): string {
  return JSON.stringify(data, null, 2);
}

export async function POST(request: NextRequest) {
  try {
    const { school } = await getCurrentSchool();
    const supabase = await createClient();
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid report request" }, { status: 400 });
    }
    const payload = body as {
      dataSource?: unknown;
      columns?: unknown;
      filters?: unknown;
      sortBy?: unknown;
      format?: unknown;
      name?: unknown;
    };
    const { dataSource, columns, filters, sortBy, format = "csv", name = "report" } = payload;

    if (typeof dataSource !== "string") return NextResponse.json({ error: "Invalid data source" }, { status: 400 });
    const table = TABLE_MAP[dataSource];
    if (!table) {
      return NextResponse.json({ error: "Invalid data source" }, { status: 400 });
    }

    const allowedFields = FIELD_MAP[dataSource] || [];
    if (!Array.isArray(columns) || !Array.isArray(filters) || !Array.isArray(sortBy)) {
      return NextResponse.json({ error: "Invalid report configuration" }, { status: 400 });
    }
    const selectFields = columns.length > 0
      ? columns.filter((c): c is string => typeof c === "string" && allowedFields.includes(c))
      : allowedFields;

    const safeFilters = filters as Filter[];
    const safeSort = sortBy as Sort[];
    const data = await fetchAllData(supabase, table, selectFields.join(","), school.id, safeFilters, safeSort, allowedFields);

    let content: string;
    let contentType: string;
    let extension: string;

    if (format === "json") {
      content = generateJSON(data);
      contentType = "application/json";
      extension = "json";
    } else if (format === "csv") {
      content = generateCSV(data, selectFields);
      contentType = "text/csv;charset=utf-8";
      extension = "csv";
    } else {
      return NextResponse.json({ error: "Invalid report format" }, { status: 400 });
    }
    const safeName = typeof name === "string" ? name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "report" : "report";

    return new NextResponse(content, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${safeName}.${extension}"`,
      },
    });
  } catch (error) {
    console.error("Report export failed:", error);
    return NextResponse.json({ error: "Failed to export report" }, { status: 500 });
  }
}