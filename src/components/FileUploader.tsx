"use client";

import { useState, useCallback, useRef } from "react";
import * as tus from "tus-js-client";

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "paused" | "complete" | "error";
  upload?: tus.Upload;
  error?: string;
}

interface FileUploaderProps {
  projectId: string;
  onUploadComplete?: () => void;
}

const ACCEPTED_TYPES = [
  ".pdf",
  ".xlsx",
  ".xlsm",
  ".csv",
  ".png",
  ".jpg",
  ".jpeg",
  ".dwg",
  ".dxf",
];

export function FileUploader({ projectId, onUploadComplete }: FileUploaderProps) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const newItems: UploadItem[] = Array.from(files).map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        progress: 0,
        status: "pending" as const,
      }));
      setItems((prev) => [...prev, ...newItems]);

      // Start uploading each file
      newItems.forEach((item) => startUpload(item));
    },
    [projectId]
  );

  function startUpload(item: UploadItem) {
    const upload = new tus.Upload(item.file, {
      endpoint: "/api/upload",
      retryDelays: [0, 3000, 5000, 10000],
      chunkSize: 5 * 1024 * 1024, // 5MB chunks
      metadata: {
        filename: item.file.name,
        filetype: item.file.type || "application/octet-stream",
        projectId,
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        const progress = Math.round((bytesUploaded / bytesTotal) * 100);
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, progress, status: "uploading" } : i
          )
        );
      },
      onSuccess: () => {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, progress: 100, status: "complete" } : i
          )
        );
        onUploadComplete?.();
      },
      onError: (error) => {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, status: "error", error: error.message }
              : i
          )
        );
      },
    });

    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, upload, status: "uploading" } : i
      )
    );

    upload.start();
  }

  function togglePause(item: UploadItem) {
    if (item.status === "uploading" && item.upload) {
      item.upload.abort();
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: "paused" } : i))
      );
    } else if (item.status === "paused" && item.upload) {
      item.upload.start();
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: "uploading" } : i))
      );
    }
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item?.upload && item.status === "uploading") {
        item.upload.abort();
      }
      return prev.filter((i) => i.id !== id);
    });
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          dragOver
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
      >
        <div className="text-gray-500">
          <p className="text-lg font-medium mb-1">
            Drop files here or click to browse
          </p>
          <p className="text-sm">
            Supports: PDF, Excel (.xlsx, .xlsm), CSV, Images, CAD (.dwg, .dxf)
          </p>
          <p className="text-xs mt-1">
            Large files are uploaded in chunks with resume support
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES.join(",")}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Upload items */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {item.file.name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        item.status === "error"
                          ? "bg-red-500"
                          : item.status === "complete"
                          ? "bg-green-500"
                          : "bg-blue-500"
                      }`}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-10 text-right">
                    {item.progress}%
                  </span>
                </div>
                {item.error && (
                  <p className="text-xs text-red-500 mt-1">{item.error}</p>
                )}
              </div>

              <div className="flex items-center gap-1">
                {(item.status === "uploading" || item.status === "paused") && (
                  <button
                    onClick={() => togglePause(item)}
                    className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-50"
                  >
                    {item.status === "uploading" ? "Pause" : "Resume"}
                  </button>
                )}
                {item.status === "complete" && (
                  <span className="text-xs text-green-600 font-medium">
                    Done
                  </span>
                )}
                <button
                  onClick={() => removeItem(item.id)}
                  className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                >
                  X
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
