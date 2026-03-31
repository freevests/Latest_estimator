"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUploader } from "./FileUploader";
import { DropboxBrowser } from "./DropboxBrowser";
import { OneDriveBrowser } from "./OneDriveBrowser";

type Tab = "upload" | "dropbox" | "onedrive";

interface CloudPickerProps {
  projectId: string;
  dropboxConnected: boolean;
  onedriveConnected: boolean;
}

export function CloudPicker({
  projectId,
  dropboxConnected,
  onedriveConnected,
}: CloudPickerProps) {
  const [activeTab, setActiveTab] = useState<Tab>("upload");
  const router = useRouter();

  function handleComplete() {
    router.refresh();
  }

  const tabs: { id: Tab; label: string; connected?: boolean }[] = [
    { id: "upload", label: "Upload Files" },
    { id: "dropbox", label: "Dropbox", connected: dropboxConnected },
    { id: "onedrive", label: "OneDrive", connected: onedriveConnected },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
            {tab.connected !== undefined && (
              <span
                className={`w-2 h-2 rounded-full ${
                  tab.connected ? "bg-green-500" : "bg-gray-300"
                }`}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-5">
        {activeTab === "upload" && (
          <FileUploader
            projectId={projectId}
            onUploadComplete={handleComplete}
          />
        )}
        {activeTab === "dropbox" && (
          <DropboxBrowser
            projectId={projectId}
            connected={dropboxConnected}
            onImport={handleComplete}
          />
        )}
        {activeTab === "onedrive" && (
          <OneDriveBrowser
            projectId={projectId}
            connected={onedriveConnected}
            onImport={handleComplete}
          />
        )}
      </div>
    </div>
  );
}
