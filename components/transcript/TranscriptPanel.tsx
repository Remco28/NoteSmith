"use client";

import { useRef, useEffect } from "react";
import { TranscriptSegment } from "@/types/notesmith";
import { formatSeconds } from "@/lib/utils/time";

interface TranscriptPanelProps {
  segments: TranscriptSegment[];
  currentTime: number;
  isLoading?: boolean;
}

export function TranscriptPanel({ segments, currentTime, isLoading }: TranscriptPanelProps) {
  const activeRef = useRef<HTMLDivElement>(null);

  // Find the active segment
  const activeIndex = segments.findIndex(
    (seg, i) => {
      const next = segments[i + 1];
      return currentTime >= seg.start && (next ? currentTime < next.start : true);
    }
  );

  // Scroll active segment into view
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeIndex]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400">
        <span className="text-sm">Loading transcript...</span>
      </div>
    );
  }

  if (!segments.length) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400">
        <span className="text-sm">No transcript available.</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {segments.map((segment, i) => {
        const isActive = i === activeIndex;
        return (
          <div
            key={`${segment.start}-${i}`}
            ref={isActive ? activeRef : null}
            className={`
              flex gap-3 px-2 py-1.5 rounded-md text-sm transition-colors duration-200 cursor-default
              ${isActive ? "bg-blue-100 text-blue-900 font-medium" : "text-gray-700"}
            `}
          >
            <span className={`shrink-0 text-xs font-mono mt-0.5 ${isActive ? "text-blue-500" : "text-gray-400"}`}>
              {formatSeconds(segment.start)}
            </span>
            <span className="leading-relaxed">{segment.text}</span>
          </div>
        );
      })}
    </div>
  );
}
