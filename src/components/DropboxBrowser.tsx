"use client";

import { useState, useEffect } from "react";
import type { CloudFile } from "@/lib/dropbox";

interface DropboxBrowserProps {
  projectId: string;
  connected: boolean;
  onImport?: () => void;
}

export function DropboxBrowser({ projectId, connected, onImport }: DropboxBrowserProps) {
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [currentPath, setCurrentPath] = useState("");
  const [pathHistory, setPathHistory] = useState<string[]>([""]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importMode, setImportMode] = useState<"download" | "link">("download");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (connected) loadFiles(currentPath);
  }, [connected, currentPath]);

  async function loadFiles(folderPath: string) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/dropbox/files?path=${encodeURIComponent(folderPath)}`
      );
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files);
      }
    } catch (err) {
      console.error("Error loading Dropbox files:", err);
    }
    setLoading(false);
  }

  function navigateToFolder(folderPath: string) {
    setCurrentPath(folderPath);
    setPathHistory((prev) => [...prev, folderPath]);
    setSelected(new Set());
  }

  function goBack() {
    if (pathHistory.length > 1) {
      const newHistory = pathHistory.slice(0, -1);
      setPathHistory(newHistory);
      setCurrentPath(newHistory[newHistory.length - 1]);
      setSelected(new Set());
    }
  }

  function toggleSelect(filePath: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) next.delete(filePath);
      else next.add(filePath);
      return next;
    });
  }

  async function handleImport() {
    if (selected.size === 0) return;
    setImporting(true);

    for (const filePath of selected) {
      await fetch("/api/dropbox/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dropboxPath: filePath,
          projectId,
          mode: importMode,
        }),
      });
    }

    setImporting(false);
    setSelected(new Set());
    onImport?.();
  }

  if (!connected) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 mb-4">Connect your Dropbox account to browse files</p>
        <button
          onClick={async () => {
            const res = await fetch("/api/dropbox/auth");
            if (res.ok) {
              const { url } = await res.json();
              window.location.href = url;
            }
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
        >
          Connect Dropbox
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={goBack}
            disabled={pathHistory.length <= 1}
            className="px-2 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Back
          </button>
          <span className="text-sm text-gray-500">
            {currentPath || "/ (root)"}
          </span>
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
                  file.isFolder
                    ? navigateToFolder(file.path)
                    : toggleSelect(file.path)
                }
              >
                {!file.isFolder && (
                  <input
                    type="checkbox"
                    checked={selected.has(file.path)}
                    onChange={() => toggleSelect(file.path)}
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
