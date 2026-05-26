"use client";

import { useState, useCallback, useEffect } from "react";
import { Header, AutoUpdateStatus } from "@/components/header/Header";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import type { TranscriptSegment, ScribbleEntry } from "@/types/notesmith";
import { loadWorkspaceState, saveScribbles } from "@/lib/storage";

export default function Home() {
  const [answerQuestions, setAnswerQuestions] = useState(false);
  const [autoUpdateStatus, setAutoUpdateStatus] = useState<AutoUpdateStatus>("manual");
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [isTranscriptLoading, setIsTranscriptLoading] = useState(false);
  const [transcriptUnavailable, setTranscriptUnavailable] = useState(false);
  const [scribbles, setScribbles] = useState<ScribbleEntry[]>([]);

  // Load persisted scribbles on mount
  useEffect(() => {
    const saved = loadWorkspaceState();
    if (saved.scribbles && saved.scribbles.length > 0) {
      setScribbles(saved.scribbles);
    }
  }, []);

  const handleUpdateNow = useCallback(() => {
    setAutoUpdateStatus("updating");
    setTimeout(() => {
      setAutoUpdateStatus(autoUpdateStatus === "on" ? "on" : "manual");
      setLastUpdated(Date.now());
    }, 1500);
  }, [autoUpdateStatus]);

  const handleAutoUpdateToggle = useCallback(() => {
    setAutoUpdateStatus((prev) => (prev === "on" ? "manual" : "on"));
  }, []);

  const handleVideoIdChange = useCallback((newVideoId: string) => {
    setVideoId(newVideoId || null);
    setCurrentPlaybackTime(0);
  }, []);

  const handleScribblesChange = useCallback((newScribbles: ScribbleEntry[]) => {
    setScribbles(newScribbles);
    saveScribbles(newScribbles);
  }, []);

  useEffect(() => {
    if (!videoId) {
      setTranscriptSegments([]);
      setTranscriptUnavailable(false);
      setIsTranscriptLoading(false);
      return;
    }

    let cancelled = false;
    setIsTranscriptLoading(true);
    setTranscriptUnavailable(false);

    fetch(`/api/transcript?videoId=${encodeURIComponent(videoId)}`)
      .then(async (response) => {
        const data = await response.json();
        if (cancelled) return;

        if (!response.ok) {
          if (response.status === 422) {
            setTranscriptUnavailable(true);
            setTranscriptSegments([]);
            return;
          }
          throw new Error(data?.error || "Failed to load transcript");
        }

        setTranscriptSegments(Array.isArray(data.segments) ? data.segments : []);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("[transcript fetch]", error);
        setTranscriptUnavailable(true);
        setTranscriptSegments([]);
      })
      .finally(() => {
        if (!cancelled) {
          setIsTranscriptLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [videoId]);

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <Header
        answerQuestions={answerQuestions}
        onAnswerQuestionsChange={setAnswerQuestions}
        autoUpdateStatus={autoUpdateStatus}
        lastUpdated={lastUpdated}
        onUpdateNow={handleUpdateNow}
        onAutoUpdateToggle={handleAutoUpdateToggle}
      />
      <WorkspaceLayout
        videoId={videoId}
        onVideoIdChange={handleVideoIdChange}
        currentPlaybackTime={currentPlaybackTime}
        onPlaybackTimeChange={setCurrentPlaybackTime}
        transcriptSegments={transcriptSegments}
        isTranscriptLoading={isTranscriptLoading}
        transcriptUnavailable={transcriptUnavailable}
        scribbles={scribbles}
        onScribblesChange={handleScribblesChange}
      />
    </main>
  );
}