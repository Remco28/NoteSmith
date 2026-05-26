"use client";

import { useState, useRef, useEffect } from "react";
import type { LivingDocumentState } from "@/types/notesmith";

interface LivingDocumentPanelProps {
  /** The current document content. */
  content: string;
  /** Called when the parent should begin streaming a new generation. */
  onGenerate?: () => void;
  /** True while a generation stream is in progress. */
  isGenerating?: boolean;
  /** Error message from the most recent failed generation, or null. */
  error: string | null;
  /** Callback to persist the final state to localStorage. */
  onPersist?: (doc: LivingDocumentState) => void;
}

/**
 * Renders the living document as a streamed, scrollable markdown pane.
 *
 * Behaviour:
 * - Renders prior content on mount (loaded from storage by the parent).
 * - While `isGenerating=true`, appends streamed chunks to visible content.
 * - On error, preserves prior content (never overwrites with partial chunks).
 * - On success, calls `onPersist` so the parent can save to localStorage.
 */
export function LivingDocumentPanel({
  content: initialContent,
  onGenerate,
  isGenerating = false,
  error,
  onPersist,
}: LivingDocumentPanelProps) {
  // Live content while streaming; falls back to initialContent when idle
  const [liveContent, setLiveContent] = useState(initialContent);
  const priorContentRef = useRef(initialContent);

  // Sync live content when not generating (initial mount / done streaming)
  useEffect(() => {
    if (!isGenerating) {
      setLiveContent(initialContent);
    }
  }, [isGenerating, initialContent]);

  // Keep a ref to the latest prior content for error recovery
  useEffect(() => {
    priorContentRef.current = initialContent;
  }, [initialContent]);

  // Expose a way for the parent to feed streamed chunks in
  // We use a callback ref pattern so the parent can drive streaming
  const appendChunkRef = useRef<((chunk: string) => void) | null>(null);

  appendChunkRef.current = (chunk: string) => {
    setLiveContent((prev) => prev + chunk);
  };

  // When generation completes successfully, persist and switch back to stable content
  useEffect(() => {
    if (!isGenerating && liveContent !== priorContentRef.current && !error) {
      // Generation just finished — persist the final result
      onPersist?.({
        content: liveContent,
        lastUpdated: Date.now(),
      });
    }
  }, [isGenerating]); // eslint-disable-line react-hooks/exhaustive-deps

  const isEmpty = !liveContent && !isGenerating;
  const showError = error !== null;

  return (
    <div className="flex flex-col h-full">
      {/* Error banner */}
      {showError && (
        <div className="mx-4 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <span className="font-medium">Generation failed:</span> {error}
          {priorContentRef.current && (
            <span className="block mt-1 text-red-500 text-xs">
              Your prior document is preserved below.
            </span>
          )}
        </div>
      )}

      {/* Empty state */}
      {isEmpty && !isGenerating && (
        <div className="flex flex-col items-center justify-center flex-1 text-gray-400">
          <span className="text-base font-medium">No document yet</span>
          <span className="text-sm mt-1">Click &ldquo;Update Now&rdquo; to generate.</span>
        </div>
      )}

      {/* Generating skeleton */}
      {isGenerating && !liveContent && (
        <div className="flex flex-col gap-2 p-4 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-4 bg-gray-200 rounded w-5/6" />
          <div className="h-4 bg-gray-200 rounded w-2/3" />
        </div>
      )}

      {/* Live document */}
      {liveContent && (
        <div className="flex-1 overflow-auto p-4">
          <article className="prose prose-sm max-w-none">
            <MarkdownRenderer content={liveContent} />
          </article>
        </div>
      )}

      {/* Inline generating indicator — shown when content exists and new content streams in */}
      {isGenerating && liveContent && (
        <div className="px-4 pb-2 text-xs text-blue-500 italic flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          Updating…
        </div>
      )}
    </div>
  );
}

/**
 * Minimal markdown renderer using innerHTML.
 * Handles the markdown constructs that are most common in LLM output:
 * headings, bold, italic, inline code, code blocks, unordered lists, links.
 * Not a full spec parser — intentionally light for v1.
 */
function MarkdownRenderer({ content }: { content: string }) {
  const html = renderMarkdownToHtml(content);
  return (
    <div
      className="markdown-body"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function renderMarkdownToHtml(md: string): string {
  let out = md;

  // Code blocks (```lang\n...\n```)
  out = out.replace(/```(\w*)\n([\s\S]*?)```/g, (_, _lang, code) => {
    return `<pre><code>${escapeHtml(code.trim())}</code></pre>`;
  });

  // Inline code (`...`)
  out = out.replace(/`([^`]+)`/g, `<code>$1</code>`);

  // Headings
  out = out.replace(/^######\s+(.*)$/gm, "<h6>$1</h6>");
  out = out.replace(/^#####\s+(.*)$/gm, "<h5>$1</h5>");
  out = out.replace(/^####\s+(.*)$/gm, "<h4>$1</h4>");
  out = out.replace(/^###\s+(.*)$/gm, "<h3>$1</h3>");
  out = out.replace(/^##\s+(.*)$/gm, "<h2>$1</h2>");
  out = out.replace(/^#\s+(.*)$/gm, "<h1>$1</h1>");

  // Bold
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__(.+?)__/g, "<strong>$1</strong>");

  // Italic
  out = out.replace(/\*(.+?)\*/g, "<em>$1</em>");
  out = out.replace(/_(.+?)_/g, "<em>$1</em>");

  // Strikethrough
  out = out.replace(/~~(.+?)~~/g, "<del>$1</del>");

  // Unordered lists (lines starting with - or *)
  out = out.replace(/^[\-\*]\s+(.*)$/gm, "<li>$1</li>");
  // Group consecutive <li> into <ul>
  out = out.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Ordered lists
  out = out.replace(/^\d+\.\s+(.*)$/gm, "<li>$1</li>");

  // Blockquotes
  out = out.replace(/^>\s+(.*)$/gm, "<blockquote>$1</blockquote>");

  // Horizontal rules
  out = out.replace(/^---$/gm, "<hr>");

  // Links
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>`);

  // Paragraphs: wrap remaining lines
  const lines = out.split("\n");
  const processed = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return "";
    if (
      trimmed.startsWith("<") &&
      (trimmed.startsWith("<h") ||
        trimmed.startsWith("<ul") ||
        trimmed.startsWith("<ol") ||
        trimmed.startsWith("<li") ||
        trimmed.startsWith("<blockquote") ||
        trimmed.startsWith("<pre") ||
        trimmed.startsWith("<hr") ||
        trimmed.startsWith("<div"))
    ) {
      return line;
    }
    return `<p>${line}</p>`;
  });

  return processed.join("\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Expose a controlled-streaming hook for the parent.
 * The parent calls `streamChunk` for each chunk from the server action,
 * and `finalize` (optionally with an error) when the stream ends.
 *
 * Usage:
 *   const { ref: appendChunkRef, streamChunk, finalize, liveContent } = useStreamingState(initialContent);
 */
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
    // If error, restore prior content
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