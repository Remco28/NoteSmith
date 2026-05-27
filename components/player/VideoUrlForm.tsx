"use client";

import { useState, useCallback, useEffect } from "react";
import { extractVideoId } from "@/lib/utils/youtube";

interface VideoUrlFormProps {
  onVideoIdChange: (videoId: string) => void;
  currentVideoId: string | null;
}

export function VideoUrlForm({ onVideoIdChange, currentVideoId }: VideoUrlFormProps) {
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isEditingLoadedVideo, setIsEditingLoadedVideo] = useState(false);
  const hasLoadedVideo = Boolean(currentVideoId);

  useEffect(() => {
    if (!hasLoadedVideo) {
      setIsEditingLoadedVideo(false);
    }
  }, [hasLoadedVideo]);

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
      setIsEditingLoadedVideo(false);
    },
    [urlInput, onVideoIdChange]
  );

  const handleClear = useCallback(() => {
    setUrlInput("");
    setError(null);
    setIsEditingLoadedVideo(false);
    onVideoIdChange("");
  }, [onVideoIdChange]);

  if (hasLoadedVideo && !isEditingLoadedVideo) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Loaded video</p>
            <p className="truncate font-mono text-sm text-gray-700">{currentVideoId}</p>
          </div>
          <button
            type="button"
            onClick={() => setIsEditingLoadedVideo(true)}
            className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-100"
          >
            Change
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-md bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-300"
          >
            Clear
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={urlInput}
          onChange={(e) => {
            setUrlInput(e.target.value);
            setError(null);
          }}
          placeholder={hasLoadedVideo ? "Paste another YouTube URL..." : "Paste YouTube URL here..."}
          className="min-w-[14rem] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="YouTube URL input"
        />
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {hasLoadedVideo ? "Load new video" : "Load"}
        </button>
        {hasLoadedVideo && (
          <button
            type="button"
            onClick={() => {
              setIsEditingLoadedVideo(false);
              setUrlInput("");
              setError(null);
            }}
            className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Cancel
          </button>
        )}
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
