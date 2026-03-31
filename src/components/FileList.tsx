"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatBytes, formatDate } from "@/lib/utils";

interface FileItem {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  source: string;
  storageType: string;
  cloudUrl?: string | null;
  status: string;
  parsedData?: string | null;
  createdAt: Date | string;
}

interface FileListProps {
  files: FileItem[];
  projectId: string;
}

const sourceIcons: Record<string, string> = {
  upload: "💻",
  dropbox: "📦",
  onedrive: "☁️",
};

const statusColors: Record<string, string> = {
  uploaded: "bg-gray-100 text-gray-700",
  linked: "bg-blue-100 text-blue-700",
  parsing: "bg-yellow-100 text-yellow-700",
  parsed: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-700",
};

export function FileList({ files, projectId }: FileListProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [viewingParsed, setViewingParsed] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<Record<string, unknown> | null>(null);

  async function handleDelete(fileId: string) {
    if (!confirm("Delete this file?")) return;
    setDeleting(fileId);
    await fetch(`/api/files?id=${fileId}`, { method: "DELETE" });
    setDeleting(null);
    router.refresh();
  }

  async function handleViewParsed(fileId: string) {
    if (viewingParsed === fileId) {
      setViewingParsed(null);
      setParsedData(null);
      return;
    }
    const res = await fetch(`/api/files/${fileId}/parse`);
    if (res.ok) {
      const data = await res.json();
      setParsedData(data);
      setViewingParsed(fileId);
    }
  }

  async function handleParse(fileId: string) {
    await fetch(`/api/files/${fileId}/parse`, { method: "POST" });
    router.refresh();
  }

  if (files.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-500">No files yet. Upload or import files to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">
        Files ({files.length})
      </h2>
      <div className="bg-white rounded-lg border border-gray-200 divide-y">
        {files.map((file) => (
          <div key={file.id}>
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="text-lg" title={file.source}>
                {sourceIcons[file.source] || "📄"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.originalName}
                  </p>
                  {file.storageType === "linked" && (
                    <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                      linked
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                  <span>{formatBytes(file.size)}</span>
                  <span>{formatDate(file.createdAt)}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs ${statusColors[file.status] || ""}`}
                  >
                    {file.status}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {file.cloudUrl && (
                  <a
                    href={file.cloudUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                  >
                    Open
                  </a>
                )}
                {file.status === "parsed" && (
                  <button
                    onClick={() => handleViewParsed(file.id)}
                    className="px-2 py-1 text-xs text-green-600 hover:bg-green-50 rounded"
                  >
                    {viewingParsed === file.id ? "Hide" : "View"}
                  </button>
                )}
                {file.status === "uploaded" &&
                  (file.originalName.endsWith(".xlsx") ||
                    file.originalName.endsWith(".xlsm") ||
                    file.originalName.endsWith(".csv")) && (
                    <button
                      onClick={() => handleParse(file.id)}
                      className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                    >
                      Parse
                    </button>
                  )}
                <button
                  onClick={() => handleDelete(file.id)}
                  disabled={deleting === file.id}
                  className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                >
                  {deleting === file.id ? "..." : "Delete"}
                </button>
              </div>
            </div>

            {/* Parsed data viewer */}
            {viewingParsed === file.id && parsedData && (
              <div className="px-4 pb-4">
                <ExcelPreview data={parsedData} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ExcelPreview({ data }: { data: Record<string, unknown> }) {
  const workbook = data as {
    sheets: Array<{
      name: string;
      headers: string[];
      rows: (string | number | boolean | null)[][];
      rowCount: number;
    }>;
  };
  const [activeSheet, setActiveSheet] = useState(0);

  if (!workbook.sheets?.length) {
    return <p className="text-sm text-gray-500">No sheets found</p>;
  }

  const sheet = workbook.sheets[activeSheet];

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Sheet tabs */}
      <div className="flex bg-gray-50 border-b overflow-x-auto">
        {workbook.sheets.map((s, i) => (
          <button
            key={i}
            onClick={() => setActiveSheet(i)}
            className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap border-b-2 ${
              i === activeSheet
                ? "border-blue-600 text-blue-600 bg-white"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {s.name} ({s.rowCount} rows)
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-auto max-h-96">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {sheet.headers.map((h, i) => (
                <th
                  key={i}
                  className="px-2 py-1.5 text-left font-medium text-gray-600 border-r last:border-r-0 whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {sheet.rows.slice(0, 50).map((row, ri) => (
              <tr key={ri} className="hover:bg-gray-50">
                {sheet.headers.map((_, ci) => (
                  <td
                    key={ci}
                    className="px-2 py-1 border-r last:border-r-0 whitespace-nowrap max-w-48 truncate"
                  >
                    {row[ci] !== null && row[ci] !== undefined
                      ? String(row[ci])
                      : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {sheet.rows.length > 50 && (
          <p className="text-xs text-gray-400 text-center py-2">
            Showing 50 of {sheet.rows.length} rows
          </p>
        )}
      </div>
    </div>
  );
}
