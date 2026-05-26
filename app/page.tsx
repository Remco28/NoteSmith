"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Header, AutoUpdateStatus } from "@/components/header/Header";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import type { TranscriptSegment, ScribbleEntry, LivingDocumentState } from "@/types/notesmith";
import {
  loadWorkspaceState,
  saveScribbles,
  loadLivingDocument,
  saveLivingDocument,
} from "@/lib/storage";
import { generateLivingDocument } from "@/app/actions/living-document";

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

  // Load persisted state on mount
  useEffect(() => {
    const saved = loadWorkspaceState();
    if (saved.scribbles && saved.scribbles.length > 0) {
      setScribbles(saved.scribbles);
    }
    if (saved.settings) {
      setAnswerQuestions(saved.settings.answerQuestions);
    }

    // Restore living document from cache (keyed by videoId + scribbles checksum)
    const cached = loadLivingDocument(saved.videoId, saved.scribbles);
    if (cached && cached.content) {
      setLivingDocument(cached);
      priorDocContentRef.current = cached.content;
    }
  }, []);

  const handleUpdateNow = useCallback(async () => {
    if (isGenerating) return;
    if (!videoId) return;

    setIsGenerating(true);
    setGenerationError(null);
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
      const finalDoc: LivingDocumentState = { content: fullText, lastUpdated: Date.now() };
      setLiveDocContent("");
      setLivingDocument(finalDoc);
      saveLivingDocument(videoId, scribbles, finalDoc);
      setLastUpdated(Date.now());
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Generation failed. Please try again.";
      setGenerationError(message);
      // Prior content preserved via priorDocContentRef; UI shows error banner
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, videoId, transcriptSegments, scribbles, answerQuestions, livingDocument.content]);

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