"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Header } from "@/components/header/Header";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import type {
  TranscriptSegment,
  ScribbleEntry,
  LivingDocumentState,
  AutoUpdateStatus,
} from "@/types/notesmith";
import {
  loadWorkspaceState,
  saveScribbles,
  loadLivingDocument,
  saveLivingDocument,
  saveAutoUpdateEnabled,
  saveSettings,
  saveTranscriptCache,
  saveVideoId,
} from "@/lib/storage";

const IDLE_TIMEOUT_MS = 60_000;

export default function Home() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [autoUpdateStatus, setAutoUpdateStatus] = useState<AutoUpdateStatus>("manual");
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [isTranscriptLoading, setIsTranscriptLoading] = useState(false);
  const [transcriptUnavailable, setTranscriptUnavailable] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [scribbles, setScribbles] = useState<ScribbleEntry[]>([]);
  const [livingDocument, setLivingDocument] = useState<LivingDocumentState>({
    content: "",
    lastUpdated: null,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [liveDocContent, setLiveDocContent] = useState("");
  const priorDocContentRef = useRef("");
  const lastScribbleChangeMsRef = useRef<number>(0);
  const idleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const saved = loadWorkspaceState();
    if (saved.videoId) {
      setVideoId(saved.videoId);
    }
    if (saved.transcriptCache && saved.transcriptCache.length > 0) {
      setTranscriptSegments(saved.transcriptCache);
    }
    if (saved.scribbles && saved.scribbles.length > 0) {
      setScribbles(saved.scribbles);
    }
    if (saved.settings) {
      setAutoUpdateStatus("manual");
      saveAutoUpdateEnabled(false);
    }

    const cached = loadLivingDocument(saved.videoId, saved.scribbles);
    if (cached && cached.content) {
      setLivingDocument(cached);
      priorDocContentRef.current = cached.content;
      setLastUpdated(cached.lastUpdated);
    }

    setIsHydrated(true);
  }, []);

  useEffect(() => {
    saveSettings({
      autoUpdateEnabled: autoUpdateStatus !== "manual",
    });
  }, [autoUpdateStatus]);

  useEffect(() => {
    if (!videoId) {
      setTranscriptSegments([]);
      setTranscriptUnavailable(false);
      setTranscriptError(null);
      return;
    }

    const controller = new AbortController();

    const loadTranscript = async () => {
      setIsTranscriptLoading(true);
      setTranscriptUnavailable(false);
      setTranscriptError(null);

      try {
        const response = await fetch(`/api/transcript?videoId=${encodeURIComponent(videoId)}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          segments?: TranscriptSegment[];
          error?: string;
        };

        if (!response.ok) {
          if (response.status === 422) {
            setTranscriptSegments([]);
            setTranscriptUnavailable(true);
            saveTranscriptCache(null);
            return;
          }

          throw new Error(payload.error ?? "Transcript fetch failed.");
        }

        const segments = payload.segments ?? [];
        setTranscriptSegments(segments);
        setTranscriptUnavailable(false);
        saveTranscriptCache(segments);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }

        setTranscriptSegments([]);
        setTranscriptUnavailable(false);
        setTranscriptError(
          err instanceof Error ? err.message : "Transcript fetch failed. Please try another video.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsTranscriptLoading(false);
        }
      }
    };

    loadTranscript();

    return () => controller.abort();
  }, [videoId]);

  const runUpdate = useCallback(async () => {
    if (isGenerating || !videoId) return;

    const priorAutoUpdateStatus = autoUpdateStatus;

    setIsGenerating(true);
    setGenerationError(null);
    setAutoUpdateStatus("updating");
    priorDocContentRef.current = livingDocument.content;
    setLiveDocContent("");

    try {
      const response = await fetch("/api/living-document", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcript: transcriptSegments,
          scribbles,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Generation failed. Please try again.");
      }

      if (!response.body) {
        throw new Error("Generation failed: empty response stream.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = value ? decoder.decode(value, { stream: true }) : "";
        fullText += chunk;
        setLiveDocContent(fullText);
      }

      fullText += decoder.decode();

      const now = Date.now();
      const finalDoc: LivingDocumentState = { content: fullText, lastUpdated: now };
      setLiveDocContent("");
      setLivingDocument(finalDoc);
      saveLivingDocument(videoId, scribbles, finalDoc);
      setLastUpdated(now);
      setAutoUpdateStatus(priorAutoUpdateStatus === "manual" ? "manual" : "on");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed. Please try again.";
      setGenerationError(message);
      setAutoUpdateStatus(priorAutoUpdateStatus === "manual" ? "manual" : "on");
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, videoId, transcriptSegments, scribbles, livingDocument.content, autoUpdateStatus]);

  const handleUpdateNow = useCallback(() => {
    if (isGenerating) return;
    runUpdate();
  }, [isGenerating, runUpdate]);

  const handleAutoUpdateToggle = useCallback(() => {
    setAutoUpdateStatus((prev) => {
      const next = prev === "on" ? "manual" : "on";
      saveAutoUpdateEnabled(next === "on");
      return next;
    });
  }, []);

  const handleVideoIdChange = useCallback((newVideoId: string) => {
    const normalizedVideoId = newVideoId || null;
    const isVideoSwitch = normalizedVideoId !== videoId;

    setVideoId(normalizedVideoId);
    saveVideoId(normalizedVideoId);
    setCurrentPlaybackTime(0);
    setTranscriptSegments([]);
    setTranscriptUnavailable(false);
    setTranscriptError(null);
    setGenerationError(null);

    if (!isVideoSwitch) {
      return;
    }

    setScribbles([]);
    saveScribbles([]);
    saveTranscriptCache(null);

    const cachedDoc = loadLivingDocument(normalizedVideoId, []);
    const nextDoc = cachedDoc ?? { content: "", lastUpdated: null };

    setLivingDocument(nextDoc);
    setLiveDocContent("");
    priorDocContentRef.current = nextDoc.content;
    setLastUpdated(nextDoc.lastUpdated);
  }, [videoId]);

  const handleScribblesChange = useCallback((newScribbles: ScribbleEntry[]) => {
    setScribbles(newScribbles);
    saveScribbles(newScribbles);
    lastScribbleChangeMsRef.current = Date.now();
  }, []);

  const displayContent = isGenerating ? liveDocContent : livingDocument.content;

  useEffect(() => {
    if (autoUpdateStatus !== "on") {
      if (idleIntervalRef.current !== null) {
        clearInterval(idleIntervalRef.current);
        idleIntervalRef.current = null;
      }
      return;
    }

    if (lastScribbleChangeMsRef.current === 0) {
      lastScribbleChangeMsRef.current = Date.now();
    }

    const intervalId = setInterval(() => {
      const elapsed = Date.now() - lastScribbleChangeMsRef.current;
      if (elapsed >= IDLE_TIMEOUT_MS) {
        lastScribbleChangeMsRef.current = Date.now();
        runUpdate();
      }
    }, 1_000);

    idleIntervalRef.current = intervalId;

    return () => {
      clearInterval(intervalId);
      idleIntervalRef.current = null;
    };
  }, [autoUpdateStatus, runUpdate]);

  if (!isHydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-500">
        Loading NoteSmith…
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-gray-50">
      <Header
        autoUpdateStatus={autoUpdateStatus}
        lastUpdated={lastUpdated}
        onUpdateNow={handleUpdateNow}
        onAutoUpdateToggle={handleAutoUpdateToggle}
        livingDocumentContent={livingDocument.content}
        videoId={videoId}
      />
      <WorkspaceLayout
        videoId={videoId}
        onVideoIdChange={handleVideoIdChange}
        currentPlaybackTime={currentPlaybackTime}
        onPlaybackTimeChange={setCurrentPlaybackTime}
        transcriptSegments={transcriptSegments}
        isTranscriptLoading={isTranscriptLoading}
        transcriptUnavailable={transcriptUnavailable}
        transcriptError={transcriptError}
        scribbles={scribbles}
        onScribblesChange={handleScribblesChange}
        livingDocumentContent={displayContent}
        livingDocumentLastUpdated={livingDocument.lastUpdated}
        isGenerating={isGenerating}
        generationError={generationError}
      />
    </main>
  );
}
