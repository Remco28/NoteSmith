"use client";

import { useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { VideoUrlForm, YouTubePlayer } from "@/components/player";
import { TranscriptPanel } from "@/components/transcript/TranscriptPanel";
import { TranscriptUnavailable } from "@/components/transcript/TranscriptUnavailable";
import { ScribblesPanel } from "@/components/scribbles/ScribblesPanel";
import { LivingDocumentPanel } from "@/components/living-document/LivingDocumentPanel";
import type { TranscriptSegment, ScribbleEntry } from "@/types/notesmith";

interface WorkspaceLayoutProps {
  videoId: string | null;
  onVideoIdChange: (videoId: string) => void;
  currentPlaybackTime: number;
  onPlaybackTimeChange: (time: number) => void;
  transcriptSegments: TranscriptSegment[];
  isTranscriptLoading: boolean;
  transcriptUnavailable: boolean;
  transcriptError?: string | null;
  scribbles: ScribbleEntry[];
  onScribblesChange: (scribbles: ScribbleEntry[]) => void;
  livingDocumentContent: string;
  livingDocumentLastUpdated: number | null;
  isGenerating?: boolean;
  generationError?: string | null;
}

export function WorkspaceLayout({
  videoId,
  onVideoIdChange,
  currentPlaybackTime,
  onPlaybackTimeChange,
  transcriptSegments,
  isTranscriptLoading,
  transcriptUnavailable,
  transcriptError = null,
  scribbles,
  onScribblesChange,
  livingDocumentContent,
  isGenerating = false,
  generationError = null,
}: WorkspaceLayoutProps) {
  const [topRowSizes, setTopRowSizes] = useState<number[]>([50, 50]);
  const [bottomRowSizes, setBottomRowSizes] = useState<number[]>([50, 50]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-h-0 flex-col overflow-hidden">
      <PanelGroup direction="vertical">
        <Panel defaultSize={50} minSize={15}>
          <PanelGroup direction="horizontal" onLayout={setTopRowSizes}>
            <Panel defaultSize={topRowSizes[0]} minSize={15}>
              <div className="h-full overflow-hidden border-r border-gray-200 bg-white">
                <div className="flex h-full min-h-0 flex-col p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">
                      YouTube Player
                    </h2>
                  </div>
                  <VideoUrlForm currentVideoId={videoId} onVideoIdChange={onVideoIdChange} />
                  {videoId && (
                    <div className="mt-3 min-h-0 flex-1">
                      <YouTubePlayer
                        videoId={videoId}
                        onTimeUpdate={onPlaybackTimeChange}
                      />
                    </div>
                  )}
                </div>
              </div>
            </Panel>

            <PanelResizeHandle className="w-1 cursor-col-resize bg-gray-200 transition-colors hover:bg-blue-400" />

            <Panel defaultSize={topRowSizes[1]} minSize={15}>
              <div className="h-full overflow-hidden bg-white">
                <div className="flex h-full min-h-0 flex-col p-4">
                  <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-gray-500">
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
                      error={transcriptError}
                    />
                  )}
                </div>
              </div>
            </Panel>
          </PanelGroup>
        </Panel>

        <PanelResizeHandle className="h-1 cursor-row-resize bg-gray-200 transition-colors hover:bg-blue-400" />

        <Panel defaultSize={50} minSize={15}>
          <PanelGroup direction="horizontal" onLayout={setBottomRowSizes}>
            <Panel defaultSize={bottomRowSizes[0]} minSize={15}>
              <div className="h-full overflow-hidden border-r border-gray-200 bg-white">
                <div className="flex h-full min-h-0 flex-col p-4">
                  <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-gray-500">
                    Raw Scribbles
                  </h2>
                  <ScribblesPanel
                    scribbles={scribbles}
                    onScribblesChange={onScribblesChange}
                    currentPlaybackTime={currentPlaybackTime}
                    videoId={videoId ?? ""}
                    disabled={!videoId}
                  />
                </div>
              </div>
            </Panel>

            <PanelResizeHandle className="w-1 cursor-col-resize bg-gray-200 transition-colors hover:bg-blue-400" />

            <Panel defaultSize={bottomRowSizes[1]} minSize={15}>
              <div className="h-full overflow-hidden bg-white">
                <div className="flex h-full min-h-0 flex-col p-4">
                  <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-gray-500">
                    Living Document
                  </h2>
                  <LivingDocumentPanel
                    content={livingDocumentContent}
                    isGenerating={isGenerating}
                    error={generationError}
                  />
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
    <div className="flex h-48 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 text-gray-400">
      <span className="text-lg font-medium">{name}</span>
      <span className="mt-1 text-sm">Placeholder</span>
    </div>
  );
}
