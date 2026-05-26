"use client";

import { useCallback } from "react";
import { ScribbleEntry } from "@/types/notesmith";
import { ScribbleEntryCard } from "./ScribbleEntryCard";
import { VoiceRecorder } from "./VoiceRecorder";

interface ScribblesPanelProps {
  scribbles: ScribbleEntry[];
  onScribblesChange: (scribbles: ScribbleEntry[]) => void;
  currentPlaybackTime: number;
  videoId: string;
  disabled?: boolean;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ScribblesPanel({
  scribbles,
  onScribblesChange,
  currentPlaybackTime,
  videoId,
  disabled = false,
}: ScribblesPanelProps) {
  const handleAddScribble = useCallback(
    (text: string = "") => {
      if (disabled) return;
      const newEntry: ScribbleEntry = {
        id: generateId(),
        text,
        timestamp: currentPlaybackTime,
        createdAt: Date.now(),
      };
      onScribblesChange([...scribbles, newEntry]);
    },
    [scribbles, onScribblesChange, currentPlaybackTime, disabled]
  );

  const handleVoiceTranscript = useCallback(
    (transcript: string) => {
      handleAddScribble(transcript);
    },
    [handleAddScribble]
  );

  const handleTextChange = useCallback(
    (id: string, text: string) => {
      onScribblesChange(
        scribbles.map((s) => (s.id === id ? { ...s, text } : s))
      );
    },
    [scribbles, onScribblesChange]
  );

  const handleDelete = useCallback(
    (id: string) => {
      onScribblesChange(scribbles.filter((s) => s.id !== id));
    },
    [scribbles, onScribblesChange]
  );

  const handleAddClick = useCallback(() => {
    handleAddScribble("");
  }, [handleAddScribble]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400">
          {scribbles.length === 0
            ? "No scribbles yet"
            : `${scribbles.length} scribbl${scribbles.length === 1 ? "e" : "es"}`}
        </span>
        <div className="flex items-center gap-2">
          <VoiceRecorder
            videoId={videoId}
            onTranscript={handleVoiceTranscript}
            disabled={disabled}
          />
          <button
            onClick={handleAddClick}
            disabled={disabled}
            className="text-xs bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-md transition-colors"
          >
            + Add scribble
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {scribbles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
            <span className="text-sm">No scribbles yet</span>
            <span className="text-xs mt-1">Click &quot;Add scribble&quot; to start</span>
          </div>
        ) : (
          [...scribbles]
            .sort((a, b) => a.timestamp - b.timestamp)
            .map((entry) => (
              <ScribbleEntryCard
                key={entry.id}
                entry={entry}
                onTextChange={handleTextChange}
                onDelete={handleDelete}
              />
            ))
        )}
      </div>
    </div>
  );
}