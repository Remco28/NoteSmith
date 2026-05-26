"use client";

import { useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { VideoUrlForm, YouTubePlayer } from "@/components/player";
import { TranscriptPanel } from "@/components/transcript/TranscriptPanel";
import { TranscriptUnavailable } from "@/components/transcript/TranscriptUnavailable";
import type { TranscriptSegment } from "@/types/notesmith";

interface WorkspaceLayoutProps {
  videoId: string | null;
  onVideoIdChange: (videoId: string) => void;
  currentPlaybackTime: number;
  onPlaybackTimeChange: (time: number) => void;
  transcriptSegments: TranscriptSegment[];
  isTranscriptLoading: boolean;
  transcriptUnavailable: boolean;
}

export function WorkspaceLayout({
  videoId,
  onVideoIdChange,
  currentPlaybackTime,
  onPlaybackTimeChange,
  transcriptSegments,
  isTranscriptLoading,
  transcriptUnavailable,
}: WorkspaceLayoutProps) {
  const [topRowSizes, setTopRowSizes] = useState<number[]>([50, 50]);
  const [bottomRowSizes, setBottomRowSizes] = useState<number[]>([50, 50]);

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      <PanelGroup direction="vertical">
        <Panel defaultSize={50} minSize={15}>
          <PanelGroup direction="horizontal" onLayout={setTopRowSizes}>
            <Panel defaultSize={topRowSizes[0]} minSize={15}>
              <div className="h-full border-r border-gray-200 bg-white overflow-auto">
                <div className="p-4">
                  <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
                    YouTube Player
                  </h2>
                  {!videoId ? (
                    <VideoUrlForm
                      currentVideoId={null}
                      onVideoIdChange={onVideoIdChange}
                    />
                  ) : (
                    <YouTubePlayer
                      videoId={videoId}
                      onTimeUpdate={onPlaybackTimeChange}
                    />
                  )}
                </div>
              </div>
            </Panel>

            <PanelResizeHandle className="w-1 bg-gray-200 hover:bg-blue-400 transition-colors cursor-col-resize" />

            <Panel defaultSize={topRowSizes[1]} minSize={15}>
              <div className="h-full bg-white overflow-auto">
                <div className="p-4">
                  <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
                    Transcript
                  </h2>
                  {!videoId ? (
                    <PlaceholderPanel name="Transcript" />
                  ) : transcriptUnavailable ? (
                    <TranscriptUnavailable />
                  ) : (
                    <TranscriptPanel
                      segments={transcriptSegments}
                      currentTime={currentPlaybackTime}
                      isLoading={isTranscriptLoading}
                    />
                  )}
                </div>
              </div>
            </Panel>
          </PanelGroup>
        </Panel>

        <PanelResizeHandle className="h-1 bg-gray-200 hover:bg-blue-400 transition-colors cursor-row-resize" />

        <Panel defaultSize={50} minSize={15}>
          <PanelGroup direction="horizontal" onLayout={setBottomRowSizes}>
            <Panel defaultSize={bottomRowSizes[0]} minSize={15}>
              <div className="h-full border-r border-gray-200 bg-white overflow-auto">
                <div className="p-4">
                  <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
                    Raw Scribbles
                  </h2>
                  <PlaceholderPanel name="Raw Scribbles" />
                </div>
              </div>
            </Panel>

            <PanelResizeHandle className="w-1 bg-gray-200 hover:bg-blue-400 transition-colors cursor-col-resize" />

            <Panel defaultSize={bottomRowSizes[1]} minSize={15}>
              <div className="h-full bg-white overflow-auto">
                <div className="p-4">
                  <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
                    Living Document
                  </h2>
                  <PlaceholderPanel name="Living Document" />
                </div>
              </div>
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
    </div>
  );
}

function PlaceholderPanel({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
      <span className="text-lg font-medium">{name}</span>
      <span className="text-sm mt-1">Placeholder</span>
    </div>
  );
}
