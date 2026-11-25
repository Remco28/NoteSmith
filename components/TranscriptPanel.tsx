"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { formatTime } from "@/lib/doc";
import type { TranscriptSegment } from "@/types/notesmith";
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
  active,
  onSeek,
}: {
  line: Line;
  active: boolean;
  onSeek: (t: number) => void;
}) {
  return (
    <button
      type="button"
      data-active={active || undefined}
      onClick={() => onSeek(line.start)}
      className={`group flex w-full gap-3 border-l-2 px-3 py-1.5 text-left text-body transition-colors hover:bg-raised ${
        active ? "border-accent bg-accent-soft text-ink" : "border-transparent text-muted"
      }`}
      style={{ transitionDuration: "var(--duration)" }}
      title={`Jump to ${formatTime(line.start)}`}
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
  segments,
  time,
  status,
  message,
  onSeek,
}: {
  segments: TranscriptSegment[];
  time: number;
  status: "loading" | "ready" | "unavailable" | "error";
  message?: string | null;
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

  return (
    <section className="panel" aria-label="Transcript">
      <header className="panel-head">
        <h2 className="panel-title">Transcript</h2>
        <div className="flex-1" />
        <button
          type="button"
          className="btn-icon w-auto gap-1.5 px-2 text-caption"
          onClick={() => setFollow(true)}
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
          onKeyDown={(e) => {
            if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(e.key)) stopFollowing();
          }}
        >
          {lines.map((line, i) => (
            <Row key={i} line={line} active={i === idx} onSeek={onSeek} />
          ))}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-body text-muted">
          {status === "loading" && <span className="pulse-dot">Fetching captions…</span>}
          {status === "unavailable" && (
            <div className="max-w-xs space-y-1">
              <p className="text-ink">No transcript for this video</p>
              <p>{message ?? "It has no captions."} You can still scribble; notes will be refined without it.</p>
            </div>
          )}
          {status === "error" && (
            <div className="max-w-xs space-y-1">
              <p className="text-ink">Couldn&apos;t load the transcript</p>
              <p>{message}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
