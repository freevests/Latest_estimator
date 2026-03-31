"use client";

import { useState, useEffect } from "react";
import type { CloudFile } from "@/lib/dropbox";

interface OneDriveBrowserProps {
  projectId: string;
  connected: boolean;
  onImport?: () => void;
}

export function OneDriveBrowser({ projectId, connected, onImport }: OneDriveBrowserProps) {
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [folderStack, setFolderStack] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: "Root" },
  ]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Map<string, CloudFile>>(new Map());
  const [importMode, setImportMode] = useState<"download" | "link">("download");
  const [importing, setImporting] = useState(false);

  const currentFolder = folderStack[folderStack.length - 1];

  useEffect(() => {
    if (connected) loadFiles(currentFolder.id);
  }, [connected, currentFolder.id]);

  async function loadFiles(itemId: string | null) {
    setLoading(true);
    try {
      const url = itemId
        ? `/api/onedrive/files?itemId=${encodeURIComponent(itemId)}`
        : "/api/onedrive/files";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files);
      }
    } catch (err) {
      console.error("Error loading OneDrive files:", err);
    }
    setLoading(false);
  }

  function navigateToFolder(file: CloudFile) {
    setFolderStack((prev) => [...prev, { id: file.id, name: file.name }]);
    setSelected(new Map());
  }

  function goBack() {
    if (folderStack.length > 1) {
      setFolderStack((prev) => prev.slice(0, -1));
      setSelected(new Map());
    }
  }

  function toggleSelect(file: CloudFile) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(file.id)) next.delete(file.id);
      else next.set(file.id, file);
      return next;
    });
  }

  async function handleImport() {
    if (selected.size === 0) return;
    setImporting(true);

    for (const [, file] of selected) {
      await fetch("/api/onedrive/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: file.id,
          fileName: file.name,
          projectId,
          mode: importMode,
          filePath: file.path,
        }),
      });
    }

    setImporting(false);
    setSelected(new Map());
    onImport?.();
  }

  if (!connected) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 mb-4">
          Connect your OneDrive account to browse files and past bids
        </p>
        <button
          onClick={async () => {
            const res = await fetch("/api/onedrive/auth");
            if (res.ok) {
              const { url } = await res.json();
              window.location.href = url;
            }
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
        >
          Connect OneDrive
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={goBack}
            disabled={folderStack.length <= 1}
            className="px-2 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Back
          </button>
          <div className="flex items-center gap-1 text-sm text-gray-500">
            {folderStack.map((f, i) => (
              <span key={i}>
                {i > 0 && <span className="mx-1">/</span>}
                <span className={i === folderStack.length - 1 ? "text-gray-900" : ""}>
                  {f.name}
                </span>
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={importMode}
            onChange={(e) => setImportMode(e.target.value as "download" | "link")}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="download">Download to server</option>
            <option value="link">Link only (no download)</option>
          </select>
          <button
            onClick={handleImport}
            disabled={selected.size === 0 || importing}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {importing
              ? "Importing..."
              : `Import ${selected.size} file${selected.size !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>

      {/* File list */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : (
        <div className="border rounded-lg divide-y">
          {files.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              Empty folder
            </div>
          ) : (
            files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                onClick={() =>
                  file.isFolder ? navigateToFolder(file) : toggleSelect(file)
                }
              >
                {!file.isFolder && (
                  <input
                    type="checkbox"
                    checked={selected.has(file.id)}
                    onChange={() => toggleSelect(file)}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded"
                  />
                )}
                <span className="text-lg">
                  {file.isFolder ? "📁" : "📄"}
                </span>
                <span className="flex-1 text-sm truncate">{file.name}</span>
                {file.size && !file.isFolder && (
                  <span className="text-xs text-gray-400">
                    {formatSize(file.size)}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
