"use client";

import { useState } from "react";
import { formatTime } from "@/lib/doc";
import type { Session } from "@/types/notesmith";
import { KeyIcon, SettingsIcon, XIcon } from "./icons";
import { Smith } from "./Smith";

function ago(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

export function Welcome({
  sessions,
  needsKey,
  error,
  onOpen,
  onForget,
  onOpenSettings,
}: {
  sessions: Session[];
  needsKey: boolean;
  error: string | null;
  onOpen: (input: string) => void;
  onForget: (videoId: string) => void;
  onOpenSettings: () => void;
}) {
  const [url, setUrl] = useState("");

  return (
    <main className="flex min-h-full flex-col">
      <div className="flex h-12 shrink-0 items-center px-4">
        <div className="flex-1" />
        <button type="button" className="btn-icon" onClick={onOpenSettings} title="Settings" aria-label="Settings">
          <SettingsIcon size={18} />
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center px-4 pb-16 pt-[8vh]">
        <Smith working={false} scale={5} />
        <h1 className="mt-5 font-pixel text-display text-ink">NoteSmith</h1>
        <p className="mt-2 max-w-md text-center text-body text-muted">
          Scribble while you watch. The smith forges your rough thoughts into clean notes, keeping what you
          meant and adding nothing you didn&apos;t.
        </p>

        <form
          className="mt-8 flex w-full gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onOpen(url);
          }}
        >
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a YouTube link"
            aria-label="YouTube link"
            className="field h-10 flex-1 text-[15px]"
          />
          <button type="submit" className="btn btn-primary h-10 px-4" disabled={!url.trim()}>
            Start
          </button>
        </form>
        <p className="mt-2 h-4 self-start text-caption text-danger" role="alert">
          {error}
        </p>

        {needsKey && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="mt-4 flex w-full items-center gap-3 rounded-md border border-accent-line bg-accent-soft px-4 py-3 text-left transition-colors hover:border-accent"
            style={{ transitionDuration: "var(--duration)" }}
          >
            <KeyIcon size={18} className="shrink-0 text-accent" />
            <span className="text-body">
              <span className="block text-ink">Add your API key to start forging</span>
              <span className="block text-caption text-muted">
                NoteSmith uses your own Anthropic or OpenAI key. It stays in this browser.
              </span>
            </span>
          </button>
        )}

        <ol className="mt-8 grid w-full grid-cols-3 gap-3 text-caption text-muted">
          {[
            ["1", "Paste a link", "Any YouTube video with captions."],
            ["2", "Scribble", "Type or speak. Each thought is stamped with the moment."],
            ["3", "Read the notes", "They forge themselves as you go. Export to Markdown."],
          ].map(([n, title, body]) => (
            <li key={n} className="rounded-md border border-border bg-surface p-3">
              <span className="font-pixel text-title text-accent">{n}</span>
              <span className="mt-1 block text-body text-ink">{title}</span>
              <span className="mt-0.5 block">{body}</span>
            </li>
          ))}
        </ol>

        {sessions.length > 0 && (
          <section className="mt-10 w-full">
            <h2 className="mb-2 text-caption font-medium uppercase tracking-wide text-faint">Recent</h2>
            <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-surface">
              {sessions.map((s) => {
                const n = s.scribbles.length;
                return (
                  <li key={s.video.id} className="group flex items-center">
                    <button
                      type="button"
                      onClick={() => onOpen(s.video.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-raised"
                      style={{ transitionDuration: "var(--duration)" }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://i.ytimg.com/vi/${s.video.id}/default.jpg`}
                        alt=""
                        className="h-9 w-12 shrink-0 rounded-[4px] bg-sunken object-cover"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body text-ink">{s.video.title ?? s.video.id}</span>
                        <span className="block truncate text-caption text-faint">
                          {n} scribble{n === 1 ? "" : "s"} · {s.doc.notes.length} note
                          {s.doc.notes.length === 1 ? "" : "s"}
                          {n > 0 ? ` · last at ${formatTime(Math.max(...s.scribbles.map((x) => x.time)))}` : ""} ·{" "}
                          {ago(s.lastOpenedAt)}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="btn-icon mr-2 opacity-40 group-hover:opacity-100 focus-visible:opacity-100"
                      onClick={() => onForget(s.video.id)}
                      title="Remove from this browser"
                      aria-label={`Remove ${s.video.title ?? s.video.id} from this browser`}
                    >
                      <XIcon size={15} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
