"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { formatTime, sections } from "@/lib/doc";
import { revealInPanel } from "@/lib/scroll";
import { formatCost } from "@/lib/llm/prices";
import type { DocVersion, LivingDocument, NoteDetail, Scribble, Spend } from "@/types/notesmith";
import { AlertIcon, CopyIcon, DownloadIcon, HammerIcon, HistoryIcon, RefreshIcon } from "./icons";
import { Smith } from "./Smith";

/** Jumping to a note's moment starts a few seconds early: people write after hearing. */
const REWIND_S = 5;

/** Inline markdown: **bold**, *italic*, `code`. Everything else is plain text. */
function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(<strong key={i++}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={i++}>{tok.slice(1, -1)}</code>);
    else out.push(<em key={i++}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const EMBERS = [
  { left: "12%", delay: "0s", drift: "6px" },
  { left: "31%", delay: "0.8s", drift: "-8px" },
  { left: "54%", delay: "0.3s", drift: "10px" },
  { left: "72%", delay: "1.4s", drift: "-5px" },
  { left: "88%", delay: "0.6s", drift: "7px" },
];

const MADE_BY: Record<NonNullable<LivingDocument["madeBy"]>, string> = {
  forge: "Forged",
  reforge: "Re-forged",
  restore: "Restored",
};

function when(at: number | null): string {
  if (!at) return "Earlier";
  const d = new Date(at);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toDateString() === new Date().toDateString()
    ? time
    : `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
}

function describe(doc: LivingDocument): string {
  const n = doc.notes.length;
  return `${MADE_BY[doc.madeBy ?? "forge"]} · ${n} note${n === 1 ? "" : "s"} · ${doc.shape === "steps" ? "steps" : "topics"}`;
}

export function DocPanel({
  doc,
  current,
  history,
  previewing,
  onPreview,
  onRestore,
  purpose,
  onPurpose,
  spend,
  scribbles,
  forging,
  progress,
  error,
  waiting,
  canForge,
  autoForge,
  freshIds,
  staleIds,
  highlightIds,
  onForge,
  onReforgeAll,
  onCopy,
  onDownload,
  onSeek,
  onHover,
  follow,
  onOpenSettings,
}: {
  /** What's shown: the current document, or an earlier version being viewed. */
  doc: LivingDocument;
  current: LivingDocument;
  history: DocVersion[];
  previewing: DocVersion | null;
  onPreview: (id: string | null) => void;
  onRestore: (version: DocVersion) => void;
  purpose: string;
  onPurpose: (text: string) => void;
  /** Tokens and cost of forging this video so far. */
  spend?: Spend;
  scribbles: Scribble[];
  forging: boolean;
  progress: string | null;
  error: { message: string; needsKey: boolean } | null;
  waiting: number;
  canForge: boolean;
  autoForge: boolean;
  freshIds: Set<string>;
  staleIds: Set<string>;
  highlightIds: Set<string>;
  onForge: () => void;
  onReforgeAll: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onSeek: (t: number) => void;
  onHover: (ids: string[] | null) => void;
  /** Scroll to the highlighted note: the scribbles panel is leading. */
  follow: boolean;
  onOpenSettings: () => void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  // Show text labels on the toolbar only when the panel itself is wide enough.
  const panelRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!follow || highlightIds.size === 0) return;
    revealInPanel(scrollRef.current, scrollRef.current?.querySelector<HTMLElement>('li[data-lit="true"]') ?? null);
  }, [follow, highlightIds]);
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWide(el.clientWidth >= 640));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const historyRef = useRef<HTMLDivElement>(null);
  const parts = sections(doc, scribbles);
  const hasNotes = doc.notes.length > 0;
  const stepsDoc = doc.shape === "steps";

  useEffect(() => {
    if (!historyOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !historyRef.current?.contains(e.target as Node)) {
        setHistoryOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [historyOpen]);

  // Escape leaves an earlier version and goes back to the current one.
  useEffect(() => {
    if (!previewing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !historyOpen) onPreview(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [previewing, historyOpen, onPreview]);

  let status: ReactNode;
  if (forging) {
    status = <span className="font-pixel text-body text-accent">{progress ?? "Forging…"}</span>;
  } else if (waiting > 0) {
    status = (
      <span className="text-caption text-muted">
        {waiting} scribble{waiting === 1 ? "" : "s"} waiting{autoForge ? "" : " · auto-forge is off"}
      </span>
    );
  } else if (hasNotes) {
    status = <span className="text-caption text-faint">Up to date</span>;
  }

  return (
    <section ref={panelRef} className="panel relative" aria-label="Living Document">
      <header className="panel-head">
        <h2 className="panel-title whitespace-nowrap">Living Document</h2>
        <div className="hidden min-w-0 items-center gap-2 truncate sm:flex" aria-live="polite">
          {status}
        </div>
        {spend && spend.calls > 0 && <SpendLabel spend={spend} />}
        <div className="flex-1" />
        <button
          type="button"
          className="btn btn-primary"
          onClick={onForge}
          disabled={!canForge}
          title="Refine new and edited scribbles now (Ctrl+Enter)"
        >
          <HammerIcon size={15} />
          {forging ? "Forging…" : "Forge now"}
        </button>
        <button
          type="button"
          className={`btn-icon ${wide ? "w-auto gap-1.5 px-2 text-body" : ""}`}
          onClick={onReforgeAll}
          disabled={forging || scribbles.length === 0}
          title="Re-forge every note from scratch, choosing the layout again. You can undo it."
          aria-label="Re-forge every note from scratch"
        >
          <RefreshIcon size={16} />
          <span className={wide ? "" : "sr-only"}>Re-forge</span>
        </button>
        <div className="relative" ref={historyRef}>
          <button
            type="button"
            className={`btn-icon ${wide ? "w-auto gap-1.5 px-2 text-body" : ""} ${historyOpen || previewing ? "bg-raised text-ink" : ""}`}
            onClick={() => setHistoryOpen((v) => !v)}
            disabled={history.length === 0}
            title={history.length ? "Earlier versions of this document" : "Earlier versions appear here after the next forge"}
            aria-label="Earlier versions of this document"
            aria-expanded={historyOpen}
          >
            <HistoryIcon size={16} />
            <span className={wide ? "" : "sr-only"}>History</span>
          </button>
          {historyOpen && (
            <div className="fade-in absolute right-0 top-10 z-20 w-80 rounded-md border border-border-strong bg-raised py-2 shadow-xl shadow-black/40">
              <p className="px-3 pb-1 text-caption text-muted">
                Every forge keeps the version before it. Pick one to look at it.
              </p>
              <ul className="max-h-80 overflow-y-auto">
                <li>
                  <button
                    type="button"
                    className={`flex w-full flex-col items-start px-3 py-1.5 text-left transition-colors hover:bg-border ${
                      previewing ? "" : "bg-accent-soft"
                    }`}
                    style={{ transitionDuration: "var(--duration)" }}
                    onClick={() => {
                      onPreview(null);
                      setHistoryOpen(false);
                    }}
                  >
                    <span className="text-body text-ink">Now</span>
                    <span className="text-caption text-muted">{describe(current)}</span>
                  </button>
                </li>
                {[...history].reverse().map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      className={`flex w-full flex-col items-start px-3 py-1.5 text-left transition-colors hover:bg-border ${
                        previewing?.id === v.id ? "bg-accent-soft" : ""
                      }`}
                      style={{ transitionDuration: "var(--duration)" }}
                      onClick={() => {
                        onPreview(v.id);
                        setHistoryOpen(false);
                      }}
                    >
                      <span className="text-body text-ink">{when(v.doc.updatedAt)}</span>
                      <span className="text-caption text-muted">{describe(v.doc)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <button
          type="button"
          className={`btn-icon ${wide ? "w-auto gap-1.5 px-2 text-body" : ""}`}
          onClick={onCopy}
          disabled={!hasNotes}
          title="Copy as Markdown"
          aria-label="Copy as Markdown"
        >
          <CopyIcon size={16} />
          <span className={wide ? "" : "sr-only"}>Copy</span>
        </button>
        <button
          type="button"
          className={`btn-icon ${wide ? "w-auto gap-1.5 px-2 text-body" : ""}`}
          onClick={onDownload}
          disabled={!hasNotes}
          title="Download as Markdown (.md)"
          aria-label="Download as Markdown"
        >
          <DownloadIcon size={16} />
          <span className={wide ? "" : "sr-only"}>Download</span>
        </button>
      </header>

      <PurposeRow purpose={purpose} onPurpose={onPurpose} shape={hasNotes ? (current.shape ?? "topics") : null} />

      {previewing && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-accent-soft px-3 py-2 text-body" role="status">
          <HistoryIcon size={16} className="shrink-0 text-accent" />
          <p className="min-w-0 flex-1 text-ink">
            Looking at the version from {when(previewing.doc.updatedAt)}.{" "}
            <span className="text-muted">Nothing changes unless you restore it.</span>
          </p>
          <button type="button" className="btn btn-secondary h-7" onClick={() => onPreview(null)}>
            Back to now
          </button>
          <button type="button" className="btn btn-primary h-7" onClick={() => onRestore(previewing)}>
            Restore this version
          </button>
        </div>
      )}

      {error && !previewing && (
        <div className="flex shrink-0 items-start gap-2 border-b border-border bg-danger-soft px-3 py-2 text-body" role="alert">
          <AlertIcon size={16} className="mt-0.5 shrink-0 text-danger" />
          <p className="min-w-0 flex-1 text-ink">
            {error.message} <span className="text-muted">Your scribbles are safe.</span>
          </p>
          {error.needsKey ? (
            <button type="button" className="btn btn-secondary h-7" onClick={onOpenSettings}>
              Open settings
            </button>
          ) : (
            <button type="button" className="btn btn-secondary h-7" onClick={onForge} disabled={!canForge}>
              Try again
            </button>
          )}
        </div>
      )}

      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto">
        {!hasNotes ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
            <Smith working={forging} scale={4} />
            <p className="max-w-xs font-doc text-doc text-muted">
              {forging ? "Forging your first notes…" : "Your scribbles, forged into clean notes, appear here."}
            </p>
          </div>
        ) : (
          <article className="max-w-[72ch] px-6 py-5">
            {parts.map((section, si) => (
              <Fragment key={section.topic + si}>
                {section.topic && (
                  <h3 className="mb-2 mt-6 font-pixel text-title uppercase tracking-wide text-accent first:mt-0">
                    {section.topic}
                  </h3>
                )}
                <ul className="space-y-1">
                  {section.notes.map(({ note, times, number }) => {
                    const ids = Object.keys(note.sources);
                    const lit = ids.some((id) => highlightIds.has(id));
                    const stale = staleIds.has(note.id);
                    return (
                      <li
                        key={note.id}
                        data-lit={lit}
                        className={`relative -mx-2 flex gap-3 rounded-sm px-2 py-1 transition-colors ${
                          lit ? "bg-accent-soft" : ""
                        } ${freshIds.has(note.id) ? "just-forged" : ""} ${stale ? "opacity-50" : ""}`}
                        title={stale ? "Its scribble changed. This note will be re-forged." : undefined}
                        style={{ transitionDuration: "var(--duration)" }}
                        onMouseEnter={() => onHover(ids)}
                        onMouseLeave={() => onHover(null)}
                      >
                        {number !== undefined ? (
                          <span className="w-6 shrink-0 text-right font-doc text-doc tabular-nums text-accent">
                            {number}.
                          </span>
                        ) : (
                          <span className={stepsDoc ? "flex w-6 shrink-0 justify-end" : "contents"} aria-hidden>
                            <span className="mt-[11px] h-1.5 w-1.5 shrink-0 bg-accent" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <span className="note-text font-doc text-doc text-ink">{renderInline(note.text)}</span>
                          {note.unrefined && (
                            <span
                              className="ml-2 inline-flex h-5 items-center rounded-[4px] border border-border-strong px-1.5 align-[2px] text-caption text-muted"
                              title="This scribble couldn't be refined, so it's kept as written. Forge again to retry."
                            >
                              as written
                            </span>
                          )}
                          <span className="ml-2 inline-flex flex-wrap gap-1 align-[2px]">
                            {times.map((t, i) => (
                              <button
                                key={i}
                                type="button"
                                className="time-chip"
                                onClick={() => onSeek(Math.max(0, t - REWIND_S))}
                                title={`Jump to just before ${formatTime(t)}`}
                                aria-label={`Jump the video to just before ${formatTime(t)}`}
                              >
                                {formatTime(t)}
                              </button>
                            ))}
                          </span>
                          {note.detail && <Detail detail={note.detail} onSeek={onSeek} />}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Fragment>
            ))}
          </article>
        )}
      </div>

      {forging && hasNotes && (
        <div className="fade-in pointer-events-none absolute bottom-3 right-4 rounded-md border border-border bg-surface p-2 shadow-lg shadow-black/40">
          <Smith working scale={2} label="Forging" />
        </div>
      )}
      {forging && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0" aria-hidden>
          {EMBERS.map((e, i) => (
            <span
              key={i}
              className="ember absolute bottom-1 h-1 w-1 bg-accent"
              style={{ left: e.left, animationDelay: e.delay, "--drift": e.drift, opacity: 0 } as React.CSSProperties}
            />
          ))}
        </div>
      )}
    </section>
  );
}

const DETAIL_TAG: Record<NoteDetail["kind"], { label: string; title: string }> = {
  video: { label: "From the video", title: "What was said in the video. Not your words." },
  answer: { label: "Answer", title: "The video's answer to your question. Not your words." },
  general: {
    label: "Answer · general knowledge",
    title: "Answered from the AI's general knowledge, not from the video. Check anything important.",
  },
};

/** Background or an answer under a note: set apart, so it never reads as the user's own words. */
function Detail({ detail, onSeek }: { detail: NoteDetail; onSeek: (t: number) => void }) {
  const tag = DETAIL_TAG[detail.kind];
  return (
    <p className="mt-1 border-l-2 border-border-strong pl-3 font-ui text-body leading-relaxed text-muted" title={tag.title}>
      <span className={`mr-1.5 text-caption font-medium uppercase tracking-wide ${detail.kind === "general" ? "text-faint" : "text-accent"}`}>
        {tag.label}
      </span>
      {renderInline(detail.text)}
      {detail.at !== undefined && (
        <button
          type="button"
          className="time-chip ml-2 align-[1px]"
          onClick={() => onSeek(Math.max(0, detail.at! - 2))}
          title={`Jump to ${formatTime(detail.at)}, where this was said`}
          aria-label={`Jump the video to ${formatTime(detail.at)}, where this was said`}
        >
          {formatTime(detail.at)}
        </button>
      )}
    </p>
  );
}

/**
 * What the notes are for, in the writer's words. Optional: left empty,
 * NoteSmith guesses from the scribbles. Saved on Enter or when the box loses focus.
 */
function PurposeRow({
  purpose,
  onPurpose,
  shape,
}: {
  purpose: string;
  onPurpose: (text: string) => void;
  shape: "steps" | "topics" | null;
}) {
  const [draft, setDraft] = useState(purpose);
  useEffect(() => setDraft(purpose), [purpose]);
  const commit = () => {
    if (draft.trim() !== purpose.trim()) onPurpose(draft);
  };

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1">
      <label htmlFor="notes-purpose" className="shrink-0 text-caption text-faint">
        Notes for
      </label>
      <input
        id="notes-purpose"
        value={draft}
        maxLength={200}
        spellCheck
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            e.stopPropagation();
            setDraft(purpose);
            requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
          }
        }}
        placeholder="Optional: what you want from them, e.g. the science behind each technique"
        title="Say what these notes are for, and NoteSmith lays them out and fills them in to fit. Left empty, it guesses from your scribbles. Changing it re-forges the notes."
        className="h-7 min-w-0 flex-1 rounded-sm border border-transparent bg-transparent px-1.5 text-body text-ink transition-colors placeholder:text-faint hover:border-border focus:border-accent focus:bg-sunken focus:outline-none"
        style={{ transitionDuration: "var(--duration)" }}
      />
      {shape && (
        <span
          className="hidden shrink-0 text-caption text-faint md:inline"
          title={
            purpose.trim()
              ? "Chosen to fit what the notes are for."
              : "Guessed from how you write your scribbles. Say what the notes are for to change it."
          }
        >
          {shape === "steps" ? "Numbered steps" : "By topic"}
        </span>
      )}
    </div>
  );
}

const n = (x: number) => x.toLocaleString();

/** What forging this video has cost so far, with the token breakdown on hover. */
function SpendLabel({ spend }: { spend: Spend }) {
  const plain = Math.max(0, spend.inputTokens - spend.cachedTokens - spend.cacheWriteTokens);
  const lines = [
    `Forging this video so far: ${formatCost(spend.costUsd)}, over ${n(spend.calls)} AI call${spend.calls === 1 ? "" : "s"}.`,
    "",
    `Sent: ${n(spend.inputTokens)} tokens`,
    `  · ${n(spend.cacheWriteTokens)} stored in the cache (the transcript, on the first forge in an hour)`,
    `  · ${n(spend.cachedTokens)} read back from the cache (cheap)`,
    `  · ${n(plain)} new (instructions, notes and scribbles)`,
    `Written by the AI: ${n(spend.outputTokens)} tokens`,
    "",
    "Worked out from the token counts at list prices; your bill may differ slightly.",
  ];
  if (spend.unpricedCalls > 0) {
    lines.push(
      `${n(spend.unpricedCalls)} call${spend.unpricedCalls === 1 ? "" : "s"} used a model NoteSmith has no price for, so ${spend.unpricedCalls === 1 ? "it isn't" : "they aren't"} in the total.`,
    );
  }
  return (
    <span className="hidden shrink-0 cursor-default text-caption tabular-nums text-faint md:inline" title={lines.join("\n")}>
      {formatCost(spend.costUsd)}
      {spend.unpricedCalls > 0 ? "+" : ""} so far
    </span>
  );
}
