"use client";

import { useState, useCallback } from "react";
import { extractVideoId } from "@/lib/utils/youtube";

interface VideoUrlFormProps {
  onVideoIdChange: (videoId: string) => void;
  currentVideoId: string | null;
}

export function VideoUrlForm({ onVideoIdChange, currentVideoId }: VideoUrlFormProps) {
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const trimmed = urlInput.trim();
      if (!trimmed) {
        setError("Please enter a YouTube URL");
        return;
      }

      const videoId = extractVideoId(trimmed);
      if (!videoId) {
        setError("Invalid YouTube URL. Please paste a valid URL (e.g., https://www.youtube.com/watch?v=...)");
        return;
      }

      onVideoIdChange(videoId);
      setUrlInput("");
    },
    [urlInput, onVideoIdChange]
  );

  const handleClear = useCallback(() => {
    setUrlInput("");
    setError(null);
    onVideoIdChange("");
  }, [onVideoIdChange]);

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={urlInput}
          onChange={(e) => {
            setUrlInput(e.target.value);
            setError(null);
          }}
          placeholder="Paste YouTube URL here..."
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          aria-label="YouTube URL input"
        />
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          Load
        </button>
        {currentVideoId && (
          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Clear
          </button>
        )}
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {currentVideoId && (
        <p className="text-xs text-gray-500">
          Video loaded: {currentVideoId}
        </p>
      )}
    </div>
  );
}