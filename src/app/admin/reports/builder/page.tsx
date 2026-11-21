"use client";

import { useState } from "react";
import { Download, X, Plus } from "lucide-react";
import PageHeading from "@/components/page-heading";

type FilterGroup = {
  id: string;
  field: string;
  operator: string;
  value: string;
};

type ReportConfig = {
  name: string;
  dataSource: string;
  columns: string[];
  filters: FilterGroup[];
  groupBy: string[];
  sortBy: { field: string; direction: "asc" | "desc" }[];
  limit: number;
};

type PreviewRow = Record<string, unknown>;

const DATA_SOURCES = [
  { value: "students", label: "Students" },
  { value: "enrolments", label: "Enrolments" },
  { value: "assessments", label: "Assessments" },
  { value: "examination_results", label: "Examination Results" },
  { value: "final_results", label: "Final Results" },
  { value: "attendance_records", label: "Attendance Records" },
  { value: "transcript_issues", label: "Issued Transcripts" },
  { value: "academic_sessions", label: "Academic Sessions" },
  { value: "classes", label: "Classes & Arms" },
];

const FIELD_OPTIONS: Record<string, { value: string; label: string; type: "text" | "number" | "date" | "select" }[]> = {
  students: [
    { value: "student_number", label: "Student Number", type: "text" },
    { value: "first_name", label: "First Name", type: "text" },
    { value: "surname", label: "Surname", type: "text" },
    { value: "status", label: "Status", type: "select" },
    { value: "admission_date", label: "Admission Date", type: "date" },
    { value: "gender", label: "Gender", type: "select" },
  ],
  enrolments: [
    { value: "student_id", label: "Student", type: "select" },
    { value: "class_id", label: "Class", type: "select" },
    { value: "session_id", label: "Session", type: "select" },
    { value: "term_id", label: "Term", type: "select" },
    { value: "is_active", label: "Active", type: "select" },
  ],
  assessments: [
    { value: "subject_id", label: "Subject", type: "select" },
    { value: "class_id", label: "Class", type: "select" },
    { value: "assessment_type", label: "Type", type: "select" },
    { value: "maximum_score", label: "Max Score", type: "number" },
    { value: "published", label: "Published", type: "select" },
  ],
  examination_results: [
    { value: "examination_id", label: "Examination", type: "select" },
    { value: "student_id", label: "Student", type: "select" },
    { value: "score", label: "Score", type: "number" },
    { value: "graded_at", label: "Graded Date", type: "date" },
    { value: "published", label: "Published", type: "select" },
  ],
  final_results: [
    { value: "student_id", label: "Student", type: "select" },
    { value: "subject_id", label: "Subject", type: "select" },
    { value: "session_id", label: "Session", type: "select" },
    { value: "term_id", label: "Term", type: "select" },
    { value: "final_total", label: "Final Total", type: "number" },
    { value: "grade", label: "Grade", type: "select" },
    { value: "grade_point", label: "Grade Point", type: "number" },
  ],
  attendance_records: [
    { value: "student_id", label: "Student", type: "select" },
    { value: "class_id", label: "Class", type: "select" },
    { value: "session_id", label: "Session", type: "select" },
    { value: "term_id", label: "Term", type: "select" },
    { value: "status", label: "Status", type: "select" },
    { value: "recorded_at", label: "Recorded Date", type: "date" },
  ],
  transcript_issues: [
    { value: "student_id", label: "Student", type: "select" },
    { value: "transcript_reference", label: "Reference", type: "text" },
    { value: "issued_at", label: "Issued Date", type: "date" },
    { value: "voided_at", label: "Voided", type: "select" },
  ],
};

const OPERATORS = {
  text: ["eq", "neq", "like", "ilike", "in"],
  number: ["eq", "neq", "gt", "gte", "lt", "lte", "in"],
  date: ["eq", "neq", "gt", "gte", "lt", "lte"],
  select: ["eq", "neq", "in"],
};

const OPERATOR_LABELS: Record<string, string> = {
  eq: "Equals",
  neq: "Not Equals",
  like: "Contains",
  ilike: "Contains (case-insensitive)",
  gt: "Greater Than",
  gte: "Greater Than or Equal",
  lt: "Less Than",
  lte: "Less Than or Equal",
  in: "In List",
};

export default function ReportBuilderPage() {
  const [config, setConfig] = useState<ReportConfig>({
    name: "",
    dataSource: "students",
    columns: [],
    filters: [],
    groupBy: [],
    sortBy: [],
    limit: 100,
  });
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const availableFields = FIELD_OPTIONS[config.dataSource] || [];

  const handleDataSourceChange = (value: string) => {
    setConfig((prev) => ({ ...prev, dataSource: value, columns: [], filters: [], groupBy: [], sortBy: [] }));
  };

  const addFilter = () => {
    const firstField = availableFields[0]?.value || "";
    const firstOperator = OPERATORS[availableFields[0]?.type || "text"][0];
    setConfig((prev) => ({
      ...prev,
      filters: [
        ...prev.filters,
        { id: crypto.randomUUID(), field: firstField, operator: firstOperator, value: "" },
      ],
    }));
  };

  const removeFilter = (id: string) => {
    setConfig((prev) => ({ ...prev, filters: prev.filters.filter((f) => f.id !== id) }));
  };

  const updateFilter = (id: string, field: string, operator: string, value: string) => {
    setConfig((prev) => ({
      ...prev,
      filters: prev.filters.map((f) =>
        f.id === id ? { ...f, field, operator, value } : f
      ),
    }));
  };

  const getFieldType = (field: string) => {
    return availableFields.find((f) => f.value === field)?.type || "text";
  };

  const getFieldOperators = (field: string) => {
    const type = getFieldType(field);
    return OPERATORS[type] || OPERATORS.text;
  };

  const handleGeneratePreview = async () => {
    setIsPreviewing(true);
    try {
      const response = await fetch("/api/admin/reports/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (response.ok) {
        const data = await response.json();
        setPreviewData(data.rows || []);
      }
    } catch (error) {
      console.error("Preview failed:", error);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleExport = async (format: "csv" | "json") => {
    try {
      const response = await fetch("/api/admin/reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, format }),
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${config.name || "report"}.${format}`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  return (
    <>
      <PageHeading title="Custom Report Builder" description="Build custom reports by selecting data sources, columns, filters, and grouping." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <section className="card p-5 space-y-5">
            <h3 className="text-sm font-bold text-slate-800">Report Configuration</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Report Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., Term 1 Performance Report"
                  value={config.name}
                  onChange={(e) => setConfig((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Data Source</label>
                <select
                  className="input"
                  value={config.dataSource}
                  onChange={(e) => handleDataSourceChange(e.target.value)}
                >
                  {DATA_SOURCES.map((ds) => (
                    <option key={ds.value} value={ds.value}>
                      {ds.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Columns to Include</label>
                <select
                  className="input"
                  multiple
                  value={config.columns}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                    setConfig((prev) => ({ ...prev, columns: selected }));
                  }}
                >
                  {availableFields.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">Hold Ctrl/Cmd to select multiple</p>
              </div>
              <div>
                <label className="label">Row Limit</label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  className="input"
                  value={config.limit}
                  onChange={(e) => setConfig((prev) => ({ ...prev, limit: parseInt(e.target.value) || 100 }))}
                />
              </div>
            </div>
          </section>

          <section className="card p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Filters</h3>
              <button className="btn btn-outline btn-sm" onClick={addFilter}>
                <Plus size={14} className="mr-1" /> Add Filter
              </button>
            </div>
            {config.filters.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No filters applied. All records will be included.</p>
            ) : (
              <div className="space-y-3">
                {config.filters.map((filter) => {
                  const fieldType = getFieldType(filter.field);
                  const operators = getFieldOperators(filter.field);
                  return (
                    <div key={filter.id} className="flex items-center gap-2 flex-wrap p-3 bg-slate-50 rounded-lg">
                      <select
                        className="input input-sm w-40"
                        value={filter.field}
                        onChange={(e) => updateFilter(filter.id, e.target.value, operators[0], "")}
                      >
                        {availableFields.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                      <select
                        className="input input-sm w-36"
                        value={filter.operator}
                        onChange={(e) => updateFilter(filter.id, filter.field, e.target.value, filter.value)}
                      >
                        {operators.map((op) => (
                          <option key={op} value={op}>
                            {OPERATOR_LABELS[op]}
                          </option>
                        ))}
                      </select>
                      {fieldType === "select" ? (
                        <select
                          className="input input-sm flex-1 min-w-[150px]"
                          value={filter.value}
                          onChange={(e) => updateFilter(filter.id, filter.field, filter.operator, e.target.value)}
                        >
                          <option value="">Select...</option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      ) : (
                        <input
                          type={fieldType === "date" ? "date" : fieldType === "number" ? "number" : "text"}
                          className="input input-sm flex-1 min-w-[150px]"
                          value={filter.value}
                          onChange={(e) => updateFilter(filter.id, filter.field, filter.operator, e.target.value)}
                          placeholder="Enter value..."
                        />
                      )}
                      <button
                        className="btn btn-ghost btn-sm text-rose-600 hover:bg-rose-50"
                        onClick={() => removeFilter(filter.id)}
                        aria-label="Remove filter"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="card p-5 space-y-5">
            <h3 className="text-sm font-bold text-slate-800">Grouping & Sorting</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Group By</label>
                <select
                  className="input"
                  multiple
                  value={config.groupBy}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                    setConfig((prev) => ({ ...prev, groupBy: selected }));
                  }}
                >
                  {availableFields.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Sort By</label>
                <div className="space-y-2">
                  {config.sortBy.map((sort, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <select
                        className="input input-sm flex-1"
                        value={sort.field}
                        onChange={(e) => {
                          const newSort = [...config.sortBy];
                          newSort[index] = { ...newSort[index], field: e.target.value };
                          setConfig((prev) => ({ ...prev, sortBy: newSort }));
                        }}
                      >
                        <option value="">Select field...</option>
                        {availableFields.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                      <select
                        className="input input-sm w-28"
                        value={sort.direction}
                        onChange={(e) => {
                          const newSort = [...config.sortBy];
                          newSort[index] = { ...newSort[index], direction: e.target.value as "asc" | "desc" };
                          setConfig((prev) => ({ ...prev, sortBy: newSort }));
                        }}
                      >
                        <option value="asc">Ascending</option>
                        <option value="desc">Descending</option>
                      </select>
                      {config.sortBy.length > 1 && (
                        <button
                          className="btn btn-ghost btn-sm text-rose-600 hover:bg-rose-50"
                          onClick={() => {
                            const newSort = config.sortBy.filter((_, i) => i !== index);
                            setConfig((prev) => ({ ...prev, sortBy: newSort }));
                          }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button className="btn btn-outline btn-sm" onClick={() => setConfig((prev) => ({ ...prev, sortBy: [...prev.sortBy, { field: "", direction: "asc" }] }))}>
                    <Plus size={14} className="mr-1" /> Add Sort
                  </button>
                </div>
              </div>
            </div>
          </section>

          <div className="flex items-center gap-3">
            <button className="btn btn-primary" onClick={handleGeneratePreview} disabled={isPreviewing}>
              {isPreviewing ? "Generating..." : "Generate Preview"}
            </button>
            <button className="btn btn-secondary" onClick={() => handleExport("csv")} disabled={previewData.length === 0}>
              <Download size={14} className="mr-1" /> Export CSV
            </button>
            <button className="btn btn-outline" onClick={() => handleExport("json")} disabled={previewData.length === 0}>
              Export JSON
            </button>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800">Preview ({previewData.length} rows)</h3>
            {isPreviewing && <span className="text-xs text-indigo-600 animate-pulse">Loading...</span>}
          </div>
          <div className="overflow-x-auto max-h-[500px]">
            {previewData.length > 0 ? (
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {Object.keys(previewData[0]).map((key) => (
                      <th key={key} className="p-2 font-semibold text-slate-700">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.slice(0, 50).map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-slate-100">
                      {Object.values(row).map((value, colIndex) => (
                        <td key={colIndex} className="p-2 text-slate-600">
                          {value === null || value === undefined ? "—" : typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-center text-slate-500 py-8">Configure report and click &ldquo;Generate Preview&rdquo; to see results.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}