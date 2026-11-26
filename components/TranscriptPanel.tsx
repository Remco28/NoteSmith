"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { formatTime } from "@/lib/doc";
import type { TranscriptSegment } from "@/types/notesmith";
import { BookmarkLink } from "./BookmarkLink";
import { LocateIcon } from "./icons";

interface Line {
  start: number;
  text: string;
}

/** Caption fragments are 2 to 5 seconds long; join them into readable lines. */
function toLines(segments: TranscriptSegment[]): Line[] {
  const lines: Line[] = [];
  let cur: Line | null = null;
  for (const seg of segments) {
    const text = seg.text.replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (!cur) {
      cur = { start: seg.start, text };
      continue;
    }
    const long = seg.start - cur.start >= 12;
    const sentenceDone = /[.?!]["')\]]?$/.test(cur.text) && seg.start - cur.start >= 6;
    const speakerChange = text.startsWith(">>");
    if (long || sentenceDone || speakerChange) {
      lines.push(cur);
      cur = { start: seg.start, text };
    } else {
      cur.text += " " + text;
    }
  }
  if (cur) lines.push(cur);
  return lines.map((l) => ({ ...l, text: l.text.replace(/^>>\s*/, "") }));
}

function currentIndex(lines: Line[], t: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].start <= t + 0.25) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

const Row = memo(function Row({
  line,
  index,
  active,
  tabbable,
  onSeek,
}: {
  line: Line;
  index: number;
  active: boolean;
  tabbable: boolean;
  onSeek: (t: number) => void;
}) {
  return (
    <button
      type="button"
      data-active={active || undefined}
      data-row={index}
      tabIndex={tabbable ? 0 : -1}
      onClick={() => onSeek(line.start)}
      className={`group flex w-full gap-3 border-l-2 px-3 py-1.5 text-left text-body transition-colors hover:bg-raised ${
        active ? "border-accent bg-accent-soft text-ink" : "border-transparent text-muted"
      }`}
      style={{ transitionDuration: "var(--duration)" }}
      title={`Jump to ${formatTime(line.start)}`}
      aria-label={`${formatTime(line.start)}: ${line.text}`}
    >
      <span
        className={`w-11 shrink-0 pt-px font-mono text-caption tabular-nums ${
          active ? "text-accent" : "text-faint group-hover:text-muted"
        }`}
      >
        {formatTime(line.start)}
      </span>
      <span>{line.text}</span>
    </button>
  );
});

export function TranscriptPanel({
  videoId,
  segments,
  time,
  status,
  onSeek,
}: {
  videoId: string;
  segments: TranscriptSegment[];
  time: number;
  status: "loading" | "ready" | "missing" | "unavailable";
  onSeek: (t: number) => void;
}) {
  const lines = useMemo(() => toLines(segments), [segments]);
  const idx = currentIndex(lines, time);
  const [follow, setFollow] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const programmatic = useRef(false);

  useEffect(() => {
    if (!follow || idx < 0) return;
    const el = listRef.current?.querySelector<HTMLElement>("[data-active]");
    if (!el || !listRef.current) return;
    const list = listRef.current;
    const target = el.offsetTop - list.clientHeight / 3;
    if (Math.abs(list.scrollTop - target) < 4) return;
    programmatic.current = true;
    list.scrollTo({ top: target, behavior: "smooth" });
    const t = setTimeout(() => (programmatic.current = false), 600);
    return () => clearTimeout(t);
  }, [idx, follow]);

  const stopFollowing = () => {
    if (!programmatic.current) setFollow(false);
  };

  // The transcript is one Tab stop; arrow keys move between lines.
  const [cursor, setCursor] = useState<number | null>(null);
  const tabbableIndex = cursor ?? Math.max(idx, 0);
  const moveFocus = (e: React.KeyboardEvent) => {
    const keys: Record<string, number> = { ArrowDown: 1, ArrowUp: -1, PageDown: 10, PageUp: -10 };
    let next: number | null = null;
    const current = Number((document.activeElement as HTMLElement | null)?.dataset?.row ?? tabbableIndex);
    if (e.key in keys) next = current + keys[e.key];
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = lines.length - 1;
    if (next === null) return;
    e.preventDefault();
    next = Math.max(0, Math.min(lines.length - 1, next));
    setCursor(next);
    setFollow(false);
    listRef.current?.querySelector<HTMLElement>(`[data-row="${next}"]`)?.focus();
  };

  return (
    <section className="panel" aria-label="Transcript">
      <header className="panel-head">
        <h2 className="panel-title">Transcript</h2>
        <div className="flex-1" />
        <button
          type="button"
          className="btn-icon w-auto gap-1.5 px-2 text-caption"
          onClick={() => {
            setFollow(true);
            setCursor(null);
          }}
          disabled={follow || status !== "ready"}
          title="Keep the current line in view"
        >
          <LocateIcon size={14} />
          Follow video
        </button>
      </header>

      {status === "ready" ? (
        <div
          ref={listRef}
          className="relative min-h-0 flex-1 overflow-y-auto py-1"
          onWheel={stopFollowing}
          onTouchMove={stopFollowing}
          onKeyDown={moveFocus}
          onFocus={(e) => {
            // Pin the Tab stop to the focused line so playback can't move it.
            const row = (e.target as HTMLElement).dataset?.row;
            if (row !== undefined) setCursor(Number(row));
          }}
          onBlur={(e) => {
            if (!listRef.current?.contains(e.relatedTarget as Node)) setCursor(null);
          }}
          role="group"
          aria-label="Transcript lines. Use the arrow keys to move, Enter to jump the video there."
        >
          {lines.map((line, i) => (
            <Row key={i} index={i} line={line} active={i === idx} tabbable={i === tabbableIndex} onSeek={onSeek} />
          ))}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-body text-muted">
          {status === "loading" && <span className="pulse-dot">Loading the transcript…</span>}
          {status === "missing" && (
            <div className="flex max-w-sm flex-col items-center gap-3">
              <p className="text-ink">No transcript yet</p>
              <p>
                Open this video on YouTube and click your NoteSmith bookmark. It brings the transcript back here, and
                your scribbles are kept.
              </p>
              <a className="btn btn-secondary h-8" href={`https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(time)}s`}>
                Open on YouTube
              </a>
              <p className="pt-2 text-caption text-faint">No bookmark yet?</p>
              <BookmarkLink className="items-center" />
            </div>
          )}
          {status === "unavailable" && (
            <div className="max-w-xs space-y-1">
              <p className="text-ink">No transcript for this video</p>
              <p>
                YouTube didn&apos;t give one for it. You can still scribble; your notes are tidied and grouped, but
                nothing is filled in from the video.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
