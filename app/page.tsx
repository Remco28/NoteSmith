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
} from "@/lib/storage";
import { generateLivingDocument } from "@/app/actions/living-document";

const IDLE_TIMEOUT_MS = 60_000; // 60 seconds

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

  // Living document state — persisted to localStorage
  const [livingDocument, setLivingDocument] = useState<LivingDocumentState>({
    content: "",
    lastUpdated: null,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Accumulates streamed chunks for live display during generation
  const [liveDocContent, setLiveDocContent] = useState("");
  // Reference to the content to restore on error
  const priorDocContentRef = useRef("");

  // Idle timer ref — tracks the last scribble change timestamp
  const lastScribbleChangeMsRef = useRef<number>(0);
  // Interval handle ref — stored so we can clean up without deps
  const idleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load persisted state on mount
  useEffect(() => {
    const saved = loadWorkspaceState();
    if (saved.scribbles && saved.scribbles.length > 0) {
      setScribbles(saved.scribbles);
    }
    if (saved.settings) {
      setAnswerQuestions(saved.settings.answerQuestions);
      // Initialize auto-update mode from persisted setting
      setAutoUpdateStatus(saved.settings.autoUpdateEnabled ? "on" : "manual");
    }

    // Restore living document from cache (keyed by videoId + scribbles checksum)
    const cached = loadLivingDocument(saved.videoId, saved.scribbles);
    if (cached && cached.content) {
      setLivingDocument(cached);
      priorDocContentRef.current = cached.content;
    }
  }, []);

  // Core update function — shared by manual and idle-triggered paths
  const runUpdate = useCallback(async () => {
    if (isGenerating) return;
    if (!videoId) return;

    setIsGenerating(true);
    setGenerationError(null);
    setAutoUpdateStatus("updating");

    // Remember prior content so we can restore on error
    priorDocContentRef.current = livingDocument.content;
    setLiveDocContent("");

    try {
      const stream = await generateLivingDocument(
        transcriptSegments,
        scribbles,
        answerQuestions,
      );

      const reader = stream.getReader();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = value ?? "";
        fullText += chunk;
        setLiveDocContent(fullText);
      }

      // Stream complete — persist and switch to stable content
      const now = Date.now();
      const finalDoc: LivingDocumentState = { content: fullText, lastUpdated: now };
      setLiveDocContent("");
      setLivingDocument(finalDoc);
      saveLivingDocument(videoId, scribbles, finalDoc);
      setLastUpdated(now);
      setAutoUpdateStatus("on");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Generation failed. Please try again.";
      setGenerationError(message);
      setAutoUpdateStatus("on");
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, videoId, transcriptSegments, scribbles, answerQuestions, livingDocument.content]);

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
    setVideoId(newVideoId || null);
    setCurrentPlaybackTime(0);
  }, []);

  const handleScribblesChange = useCallback((newScribbles: ScribbleEntry[]) => {
    setScribbles(newScribbles);
    saveScribbles(newScribbles);
    // Reset idle timer on any scribble activity
    lastScribbleChangeMsRef.current = Date.now();
  }, []);

  // When not generating, the display uses livingDocument.content.
  // During generation, liveDocContent takes over.
  const displayContent = isGenerating ? liveDocContent : livingDocument.content;

  const handlePersistLivingDocument = useCallback(
    (doc: LivingDocumentState) => {
      setLivingDocument(doc);
      if (videoId) {
        saveLivingDocument(videoId, scribbles, doc);
      }
    },
    [videoId, scribbles],
  );

  // Idle auto-update effect
  useEffect(() => {
    // Only run when auto-update is enabled and not currently generating
    if (autoUpdateStatus !== "on") {
      // Clear any existing interval when auto-update is disabled
      if (idleIntervalRef.current !== null) {
        clearInterval(idleIntervalRef.current);
        idleIntervalRef.current = null;
      }
      return;
    }

    // Initialize the last activity timestamp if not set
    if (lastScribbleChangeMsRef.current === 0) {
      lastScribbleChangeMsRef.current = Date.now();
    }

    // Set up polling interval to check for idle expiry
    const intervalId = setInterval(() => {
      const elapsed = Date.now() - lastScribbleChangeMsRef.current;
      if (elapsed >= IDLE_TIMEOUT_MS) {
        // Reset the timer first to prevent double-fire
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
        livingDocumentContent={displayContent}
        livingDocumentLastUpdated={livingDocument.lastUpdated}
        isGenerating={isGenerating}
        generationError={generationError}
        onPersistLivingDocument={handlePersistLivingDocument}
      />
    </main>
  );
}