"use client";

import { Download } from "lucide-react";

export default function CsvDownload({
  csv,
  filename,
  label = "Export CSV",
  disabled = false,
}: {
  csv: string;
  filename: string;
  label?: string;
  disabled?: boolean;
}) {
  function download() {
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button type="button" className="btn btn-secondary" onClick={download} disabled={disabled}>
      <Download size={14} className="mr-1" /> {label}
    </button>
  );
}
