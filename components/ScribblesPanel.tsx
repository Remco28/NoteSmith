"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatTime } from "@/lib/doc";
import { useSpeech } from "@/lib/useSpeech";
import type { Scribble } from "@/types/notesmith";
import { EnterIcon, MicIcon, PencilIcon, StopIcon, TrashIcon } from "./icons";

function autosize(el: HTMLTextAreaElement | null, maxRows = 8) {
  if (!el) return;
  el.style.height = "auto";
  const line = 20;
  el.style.height = `${Math.min(el.scrollHeight, line * maxRows + 16)}px`;
}

function ScribbleRow({
  scribble,
  pending,
  highlighted,
  isNew,
  onSeek,
  onEdit,
  onDelete,
  onHover,
}: {
  scribble: Scribble;
  pending: boolean;
  highlighted: boolean;
  isNew: boolean;
  onSeek: (t: number) => void;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onHover: (ids: string[] | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(scribble.text);
  const ref = useRef<HTMLTextAreaElement>(null);
  const rowRef = useRef<HTMLLIElement>(null);
  const textRef = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);

  useEffect(() => {
    if (!editing && refocus.current) {
      refocus.current = false;
      textRef.current?.focus();
    }
  }, [editing]);

  useLayoutEffect(() => {
    if (editing) {
      autosize(ref.current);
      ref.current?.focus();
      ref.current?.setSelectionRange(draft.length, draft.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  useEffect(() => {
    if (isNew) rowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [isNew]);

  const commit = () => {
    setEditing(false);
    const text = draft.trim();
    if (!text) onDelete(scribble.id);
    else if (text !== scribble.text) onEdit(scribble.id, text);
  };

  return (
    <li
      ref={rowRef}
      className={`group flex items-start gap-2.5 rounded-sm px-2 py-1.5 transition-colors ${
        highlighted ? "bg-accent-soft" : "hover:bg-raised"
      } ${isNew ? "fade-in" : ""}`}
      style={{ transitionDuration: "var(--duration)" }}
      onMouseEnter={() => onHover([scribble.id])}
      onMouseLeave={() => onHover(null)}
    >
      <button
        type="button"
        className="time-chip mt-px"
        onClick={() => onSeek(Math.max(0, scribble.time - 5))}
        title={`Jump to just before ${formatTime(scribble.time)}`}
        aria-label={`Jump the video to just before ${formatTime(scribble.time)}, where you wrote this`}
      >
        {formatTime(scribble.time)}
      </button>

      {editing ? (
        <textarea
          ref={ref}
          value={draft}
          rows={1}
          aria-label="Edit scribble"
          onChange={(e) => {
            setDraft(e.target.value);
            autosize(e.target);
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              refocus.current = true;
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              refocus.current = true;
              setDraft(scribble.text);
              setEditing(false);
            }
          }}
          className="min-w-0 flex-1 resize-none rounded-[4px] border border-accent bg-sunken px-1.5 py-px font-mono text-body text-ink focus:outline-none"
        />
      ) : (
        <button
          ref={textRef}
          type="button"
          aria-label={`Scribble at ${formatTime(scribble.time)}: ${scribble.text}. Press Enter to edit.`}
          className="min-w-0 flex-1 cursor-text whitespace-pre-wrap break-words text-left font-mono text-body text-ink"
          onClick={() => {
            setDraft(scribble.text);
            setEditing(true);
          }}
          title="Click to edit"
        >
          {scribble.text}
        </button>
      )}

      <span className="mt-1.5 flex h-2 w-2 shrink-0 items-center justify-center" aria-hidden={!pending}>
        {pending && (
          <span className="pulse-dot h-2 w-2 rounded-full bg-accent" title="Not forged yet" aria-label="Not forged yet" />
        )}
      </span>

      <button
        type="button"
        className="btn-icon -my-1 h-7 w-7 opacity-60 group-hover:opacity-100 focus-visible:opacity-100"
        onClick={() => {
          setDraft(scribble.text);
          setEditing(true);
        }}
        disabled={editing}
        title="Edit scribble"
        aria-label={`Edit scribble: ${scribble.text}`}
      >
        <PencilIcon size={14} />
      </button>
      <button
        type="button"
        className="btn-icon -my-1 h-7 w-7 opacity-60 group-hover:opacity-100 focus-visible:opacity-100"
        onClick={() => onDelete(scribble.id)}
        title="Delete scribble"
        aria-label={`Delete scribble: ${scribble.text}`}
      >
        <TrashIcon size={14} />
      </button>
    </li>
  );
}

export function ScribblesPanel({
  scribbles,
  pendingIds,
  highlightIds,
  lastAddedId,
  time,
  enabled,
  composerRef,
  getTime,
  pauseVideo,
  onAdd,
  onEdit,
  onDelete,
  onSeek,
  onHover,
}: {
  scribbles: Scribble[];
  pendingIds: Set<string>;
  highlightIds: Set<string>;
  lastAddedId: string | null;
  time: number;
  enabled: boolean;
  composerRef: React.RefObject<HTMLTextAreaElement | null>;
  getTime: () => number;
  pauseVideo: () => void;
  onAdd: (text: string, time: number) => void;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onSeek: (t: number) => void;
  onHover: (ids: string[] | null) => void;
}) {
  const [text, setText] = useState("");
  const [draftTime, setDraftTime] = useState<number | null>(null);
  const voiceTime = useRef(0);
  const speech = useSpeech((spoken) => onAdd(spoken, voiceTime.current));
  const sorted = [...scribbles].sort((a, b) => a.time - b.time || a.createdAt - b.createdAt);
  const shownTime = draftTime ?? time;

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onAdd(t, draftTime ?? getTime());
    setText("");
    setDraftTime(null);
    requestAnimationFrame(() => autosize(composerRef.current));
  };

  const toggleVoice = () => {
    if (speech.listening) {
      speech.stop();
      return;
    }
    pauseVideo();
    voiceTime.current = getTime();
    speech.start();
  };

  return (
    <section className="panel" aria-label="Raw scribbles">
      <header className="panel-head">
        <h2 className="panel-title">Raw Scribbles</h2>
        <span className="text-caption text-faint">
          {scribbles.length === 0 ? "" : `${scribbles.length} scribble${scribbles.length === 1 ? "" : "s"}`}
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5">
        {sorted.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-6 text-center">
            <p className="font-mono text-title text-faint">Raw material goes here.</p>
            <p className="text-caption text-faint">
              Type a thought and press Enter. It&apos;s stamped with the moment in the video.
            </p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {sorted.map((s) => (
              <ScribbleRow
                key={s.id}
                scribble={s}
                pending={pendingIds.has(s.id)}
                highlighted={highlightIds.has(s.id)}
                isNew={s.id === lastAddedId}
                onSeek={onSeek}
                onEdit={onEdit}
                onDelete={onDelete}
                onHover={onHover}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="shrink-0 border-t border-border p-2">
        {speech.error && (
          <p className="mb-1.5 px-1 text-caption text-danger" role="alert">
            {speech.error}
          </p>
        )}
        <div
          className={`rounded-sm border bg-sunken transition-colors focus-within:border-accent ${
            speech.listening ? "border-accent" : "border-border hover:border-border-strong"
          }`}
          style={{ transitionDuration: "var(--duration)" }}
        >
          {speech.listening ? (
            <div className="min-h-[52px] px-2.5 py-2 font-mono text-body text-muted" aria-live="polite">
              {speech.interim || <span className="pulse-dot">Listening… the video is paused.</span>}
            </div>
          ) : (
            <textarea
              ref={composerRef}
              value={text}
              rows={2}
              disabled={!enabled}
              placeholder={enabled ? "Type a thought…" : "Load a video to start scribbling"}
              aria-label="New scribble"
              onChange={(e) => {
                if (!text && e.target.value) setDraftTime(getTime());
                if (!e.target.value) setDraftTime(null);
                setText(e.target.value);
                autosize(e.target);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit();
                } else if (e.key === "Escape") {
                  (e.target as HTMLTextAreaElement).blur();
                }
              }}
              className="block min-h-[52px] w-full resize-none bg-transparent px-2.5 py-2 font-mono text-body text-ink placeholder:text-faint focus:outline-none disabled:cursor-not-allowed"
            />
          )}
          <div className="flex items-center gap-2 px-1.5 pb-1.5">
            <span
              className="time-chip pointer-events-none"
              title="This scribble will be stamped with this moment"
            >
              {formatTime(shownTime)}
            </span>
            <span className="truncate text-caption text-faint">
              {speech.listening ? (
                "Click stop when you're done"
              ) : (
                <span className="hidden sm:inline">Enter to add · Shift+Enter for a new line</span>
              )}
            </span>
            <div className="flex-1" />
            <button
              type="button"
              className={speech.listening ? "btn-icon bg-accent-soft text-accent enabled:hover:text-accent" : "btn-icon"}
              onClick={toggleVoice}
              disabled={!enabled || !speech.supported}
              title={
                !speech.supported
                  ? "Voice input isn't supported in this browser"
                  : speech.listening
                    ? "Stop and add what you said"
                    : "Speak a scribble (pauses the video)"
              }
              aria-label={speech.listening ? "Stop voice input" : "Start voice input"}
            >
              {speech.listening ? <StopIcon size={16} /> : <MicIcon size={16} />}
            </button>
            <button
              type="button"
              className="btn-icon"
              onClick={submit}
              disabled={!enabled || !text.trim() || speech.listening}
              title="Add scribble (Enter)"
              aria-label="Add scribble"
            >
              <EnterIcon size={16} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
