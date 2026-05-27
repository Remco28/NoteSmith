"use client";

import type { AutoUpdateStatus } from "@/types/notesmith";

interface HeaderProps {
  autoUpdateStatus: AutoUpdateStatus;
  lastUpdated: number | null;
  onUpdateNow: () => void;
  onAutoUpdateToggle: () => void;
  /** Current living document content for export actions. */
  livingDocumentContent: string;
  /** Video ID used to name the exported file. */
  videoId: string | null;
}

export function Header({
  autoUpdateStatus,
  lastUpdated,
  onUpdateNow,
  onAutoUpdateToggle,
  livingDocumentContent,
  videoId,
}: HeaderProps) {
  const isUpdating = autoUpdateStatus === "updating";

  const formatLastUpdated = (timestamp: number | null): string => {
    if (!timestamp) return "never";
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const renderAutoUpdateStatus = (): string => {
    switch (autoUpdateStatus) {
      case "on":
        return `Auto-updates on · last: ${formatLastUpdated(lastUpdated)}`;
      case "manual":
        return "Manual only";
      case "updating":
        return "Updating…";
      default:
        return "Manual only";
    }
  };

  const handleDownloadMarkdown = () => {
    if (!livingDocumentContent) return;
    const date = new Date().toISOString().slice(0, 10);
    const filename = videoId ? `notesmith-${videoId}-${date}.md` : `notesmith-${date}.md`;
    const blob = new Blob([livingDocumentContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = async () => {
    if (!livingDocumentContent) return;
    try {
      await navigator.clipboard.writeText(livingDocumentContent);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = livingDocumentContent;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  };

  const hasContent = !!livingDocumentContent;

  return (
    <header className="flex h-14 items-center gap-4 border-b border-gray-200 bg-white px-4">
      <h1 className="mr-2 text-lg font-semibold text-gray-900">NoteSmith</h1>

      <button
        onClick={onAutoUpdateToggle}
        disabled={isUpdating}
        className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span>{renderAutoUpdateStatus()}</span>
      </button>

      <button
        onClick={onUpdateNow}
        disabled={isUpdating}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isUpdating ? "Updating…" : "Update Now"}
      </button>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={handleCopyToClipboard}
          disabled={!hasContent}
          title={hasContent ? "Copy living document to clipboard" : "No document to copy"}
          className="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Copy
        </button>
        <button
          onClick={handleDownloadMarkdown}
          disabled={!hasContent}
          title={hasContent ? "Download living document as Markdown" : "No document to download"}
          className="rounded-md bg-gray-700 px-3 py-1.5 text-sm text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Download .md
        </button>
      </div>
    </header>
  );
}
