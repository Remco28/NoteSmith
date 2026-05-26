"use client";

import type { AutoUpdateStatus } from "@/types/notesmith";

interface HeaderProps {
  answerQuestions: boolean;
  onAnswerQuestionsChange: (value: boolean) => void;
  autoUpdateStatus: AutoUpdateStatus;
  lastUpdated: number | null;
  onUpdateNow: () => void;
  onAutoUpdateToggle: () => void;
}

export function Header({
  answerQuestions,
  onAnswerQuestionsChange,
  autoUpdateStatus,
  lastUpdated,
  onUpdateNow,
  onAutoUpdateToggle,
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

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-4">
      {/* App title */}
      <h1 className="text-lg font-semibold text-gray-900 mr-4">NoteSmith</h1>

      {/* Answer questions toggle */}
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <span>Answer questions</span>
        <input
          type="checkbox"
          checked={answerQuestions}
          onChange={(e) => onAnswerQuestionsChange(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      </label>

      {/* Auto-update toggle */}
      <button
        onClick={onAutoUpdateToggle}
        disabled={isUpdating}
        className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span>{renderAutoUpdateStatus()}</span>
      </button>

      {/* Update Now button */}
      <button
        onClick={onUpdateNow}
        disabled={isUpdating}
        className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isUpdating ? "Updating…" : "Update Now"}
      </button>

      {/* Export actions placeholder */}
      <div className="ml-auto flex items-center gap-2">
        <span className="text-sm text-gray-500 italic">Export: coming soon</span>
      </div>
    </header>
  );
}