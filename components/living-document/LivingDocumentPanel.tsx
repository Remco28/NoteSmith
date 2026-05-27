"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface LivingDocumentPanelProps {
  /** The current document content. */
  content: string;
  /** True while a generation stream is in progress. */
  isGenerating?: boolean;
  /** Error message from the most recent failed generation, or null. */
  error: string | null;
}

export function LivingDocumentPanel({
  content,
  isGenerating = false,
  error,
}: LivingDocumentPanelProps) {
  const priorContentRef = useRef(content);

  useEffect(() => {
    if (!isGenerating && content) {
      priorContentRef.current = content;
    }
  }, [content, isGenerating]);

  const isEmpty = !content && !isGenerating;
  const showError = error !== null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {showError && (
        <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="font-medium">Generation failed:</span> {error}
          {priorContentRef.current && (
            <span className="mt-1 block text-xs text-red-500">
              Your prior document is preserved below.
            </span>
          )}
        </div>
      )}

      {isEmpty && !isGenerating && (
        <div className="flex flex-1 flex-col items-center justify-center text-gray-400">
          <span className="text-base font-medium">No document yet</span>
          <span className="mt-1 text-sm">Click &ldquo;Update Now&rdquo; to generate.</span>
        </div>
      )}

      {isGenerating && !content && (
        <div className="animate-pulse p-4">
          <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="h-5 w-1/3 rounded bg-gray-200" />
            <div className="h-4 w-5/6 rounded bg-gray-200" />
            <div className="h-4 w-2/3 rounded bg-gray-200" />
            <div className="h-4 w-3/4 rounded bg-gray-200" />
          </div>
        </div>
      )}

      {content && (
        <div className="flex-1 overflow-auto p-4">
          <article className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="notesmith-markdown prose prose-sm max-w-none p-5 text-gray-800 prose-headings:text-gray-900 prose-p:text-gray-700 prose-strong:text-gray-900 prose-code:text-gray-900 prose-pre:bg-gray-950 prose-li:marker:text-gray-400">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          </article>
        </div>
      )}

      {isGenerating && content && (
        <div className="flex items-center gap-1 px-4 pb-2 text-xs italic text-blue-500">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-400" />
          Updating…
        </div>
      )}
    </div>
  );
}

export function useStreamingState(initialContent: string) {
  const [liveContent, setLiveContent] = useState(initialContent);
  const priorContentRef = useRef(initialContent);
  const appendChunkRef = useRef<((chunk: string) => void) | null>(null);

  appendChunkRef.current = (chunk: string) => {
    setLiveContent((prev) => prev + chunk);
  };

  const streamChunk = (chunk: string) => {
    appendChunkRef.current?.(chunk);
  };

  const finalize = (err?: string) => {
    if (err) {
      setLiveContent(priorContentRef.current);
    }
  };

  const resetTo = (content: string) => {
    priorContentRef.current = content;
    setLiveContent(content);
  };

  return { liveContent, streamChunk, finalize, resetTo, priorContentRef };
}
