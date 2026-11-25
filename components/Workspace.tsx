"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import {
  applyRefine,
  emptyDocument,
  forgedIds,
  newId,
  planRefine,
  toExistingNotes,
  toMarkdown,
  toPending,
} from "@/lib/doc";
import {
  defaultSettings,
  deleteSession,
  listSessions,
  loadCurrentVideoId,
  loadSession,
  loadSettings,
  loadTranscript,
  saveCurrentVideoId,
  saveSession,
  saveSettings,
  saveTranscript,
} from "@/lib/storage";
import { extractVideoId } from "@/lib/utils/youtube";
import type {
  LivingDocument,
  Provider,
  RefineResponse,
  Session,
  Settings,
  TranscriptSegment,
} from "@/types/notesmith";
import { DocPanel } from "./DocPanel";
import { KeyIcon, SettingsIcon } from "./icons";
import { Player, type PlayerHandle } from "./Player";
import { ScribblesPanel } from "./ScribblesPanel";
import { SettingsDialog } from "./SettingsDialog";
import { Toasts, useToasts } from "./Toasts";
import { TranscriptPanel } from "./TranscriptPanel";
import { Welcome } from "./Welcome";

/** Scribbles sent per request; bigger sets are forged in rounds. */
const BATCH = 25;
/** Auto-forge waits this long after the last change. */
const AUTO_FORGE_DELAY_MS = 4000;

type TranscriptState = {
  status: "loading" | "ready" | "unavailable" | "error";
  segments: TranscriptSegment[];
  message: string | null;
};

const emptyTranscript: TranscriptState = { status: "loading", segments: [], message: null };

function newSession(videoId: string): Session {
  return {
    video: { id: videoId, title: null, author: null },
    scribbles: [],
    doc: emptyDocument(),
    lastOpenedAt: Date.now(),
  };
}

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return narrow;
}

function Handle({ direction }: { direction: "horizontal" | "vertical" }) {
  return (
    <PanelResizeHandle
      aria-label={direction === "horizontal" ? "Resize panels left and right" : "Resize panels up and down"}
      className={`group relative flex items-center justify-center ${direction === "horizontal" ? "w-2" : "h-2"}`}
    >
      <span
        className={`rounded-full bg-border transition-colors group-hover:bg-accent group-data-[resize-handle-state=drag]:bg-accent ${
          direction === "horizontal" ? "h-8 w-[3px]" : "h-[3px] w-8"
        }`}
        style={{ transitionDuration: "var(--duration)" }}
      />
    </PanelResizeHandle>
  );
}

export function Workspace() {
  const [hydrated, setHydrated] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [serverKey, setServerKey] = useState<Record<Provider, boolean>>({ anthropic: false, openai: false });
  const [session, setSession] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [openError, setOpenError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptState>(emptyTranscript);
  const [time, setTime] = useState(0);
  const [forging, setForging] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [forgeError, setForgeError] = useState<{ message: string; needsKey: boolean } | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [hoverIds, setHoverIds] = useState<Set<string>>(new Set());
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { toasts, show, dismiss } = useToasts();
  const narrow = useNarrow();

  const playerRef = useRef<PlayerHandle>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;
  const transcriptRef = useRef(transcript);
  transcriptRef.current = transcript;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const forgingRef = useRef(false);

  /* ---------- load ---------- */

  useEffect(() => {
    setSettings(loadSettings());
    setSessions(listSessions());
    const current = loadCurrentVideoId();
    if (current) {
      const saved = loadSession(current);
      if (saved) setSession({ ...saved, lastOpenedAt: Date.now() });
    }
    setHydrated(true);
    fetch("/api/config")
      .then((r) => r.json())
      .then((c: { serverKey?: Record<Provider, boolean> }) => c.serverKey && setServerKey(c.serverKey))
      .catch(() => {});
  }, []);

  /* ---------- persistence ---------- */

  useEffect(() => {
    if (!session) return;
    const t = setTimeout(() => saveSession(session), 300);
    return () => clearTimeout(t);
  }, [session]);

  useEffect(() => {
    const flush = () => sessionRef.current && saveSession(sessionRef.current);
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);

  /* ---------- transcript ---------- */

  const videoId = session?.video.id ?? null;

  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;
    const cached = loadTranscript(videoId);
    const needInfo = !sessionRef.current?.video.title;
    if (cached?.length && !needInfo) {
      setTranscript({ status: "ready", segments: cached, message: null });
      return;
    }
    setTranscript(cached?.length ? { status: "ready", segments: cached, message: null } : emptyTranscript);

    const lang = (navigator.language || "en").slice(0, 2);
    fetch(`/api/transcript?videoId=${videoId}&lang=${lang}`)
      .then(async (r) => ({ ok: r.ok, status: r.status, body: await r.json() }))
      .then(({ ok, status, body }) => {
        if (cancelled) return;
        if (body.title || body.author) {
          setSession((s) =>
            s && s.video.id === videoId
              ? { ...s, video: { ...s.video, title: body.title ?? s.video.title, author: body.author ?? s.video.author } }
              : s,
          );
        }
        if (ok) {
          setTranscript({ status: "ready", segments: body.segments, message: null });
          saveTranscript(videoId, body.segments);
        } else if (!cached?.length) {
          setTranscript({
            status: status === 422 ? "unavailable" : "error",
            segments: [],
            message: body.error ?? null,
          });
        }
      })
      .catch(() => {
        if (!cancelled && !cached?.length)
          setTranscript({ status: "error", segments: [], message: "Check your connection and reload." });
      });
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  /* ---------- opening and closing videos ---------- */

  const openVideo = useCallback((input: string) => {
    if (!input.trim()) {
      setOpenError("Paste a YouTube link first.");
      return;
    }
    const id = extractVideoId(input);
    if (!id) {
      setOpenError("That doesn't look like a YouTube link.");
      return;
    }
    setOpenError(null);
    if (sessionRef.current) saveSession(sessionRef.current);
    const s = loadSession(id) ?? newSession(id);
    const opened = { ...s, lastOpenedAt: Date.now() };
    setSession(opened);
    saveSession(opened);
    saveCurrentVideoId(id);
    setTime(0);
    setForgeError(null);
    setFreshIds(new Set());
    setLastAddedId(null);
  }, []);

  const closeVideo = useCallback(() => {
    if (sessionRef.current) saveSession(sessionRef.current);
    saveCurrentVideoId(null);
    setSession(null);
    setSessions(listSessions());
    setTranscript(emptyTranscript);
  }, []);

  // Put the cursor in the scribble box when a video opens.
  useEffect(() => {
    if (!videoId) return;
    const t = setTimeout(() => composerRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, [videoId]);

  /* ---------- derived state ---------- */

  const scribbles = useMemo(() => session?.scribbles ?? [], [session?.scribbles]);
  const doc = session?.doc ?? emptyDocument();
  const plan = useMemo(() => planRefine(scribbles, doc), [scribbles, doc]);
  const forged = useMemo(() => forgedIds(scribbles, doc), [scribbles, doc]);
  const pendingIds = useMemo(
    () => new Set(scribbles.filter((s) => s.text.trim() && !forged.has(s.id)).map((s) => s.id)),
    [scribbles, forged],
  );
  const staleIds = useMemo(() => {
    const kept = new Set(plan.kept.map((n) => n.id));
    return new Set(doc.notes.filter((n) => !kept.has(n.id)).map((n) => n.id));
  }, [plan, doc.notes]);
  const hasKey = Boolean(settings.apiKeys[settings.provider]?.trim()) || serverKey[settings.provider];
  const needsWork = plan.pending.length > 0 || staleIds.size > 0;
  const canForge = Boolean(session) && hasKey && !forging && needsWork;

  /* ---------- forging ---------- */

  const forge = useCallback(
    async (mode: "new" | "all" = "new") => {
      if (forgingRef.current || !sessionRef.current) return;
      const cfg = settingsRef.current;
      forgingRef.current = true;
      setForging(true);
      setForgeError(null);
      const forVideo = sessionRef.current.video.id;
      let base: LivingDocument = mode === "all" ? emptyDocument() : sessionRef.current.doc;
      const total = planRefine(sessionRef.current.scribbles, base).pending.length;
      let done = 0;

      try {
        for (let round = 0; round < Math.ceil(total / BATCH) + 3; round++) {
          const current = sessionRef.current;
          if (!current || current.video.id !== forVideo) return;
          const { kept, pending } = planRefine(current.scribbles, base);
          if (pending.length === 0) {
            const finalDoc = { notes: kept, updatedAt: Date.now() };
            setSession((s) => (s && s.video.id === forVideo ? { ...s, doc: finalDoc } : s));
            break;
          }
          const batch = pending.slice(0, BATCH);
          setProgress(total > BATCH ? `Forging ${Math.min(done + batch.length, total)} of ${total}…` : "Forging…");

          const key = cfg.apiKeys[cfg.provider]?.trim();
          const res = await fetch("/api/refine", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(key ? { "x-api-key": key } : {}) },
            body: JSON.stringify({
              provider: cfg.provider,
              model: cfg.models[cfg.provider],
              video: { title: current.video.title, author: current.video.author },
              notes: toExistingNotes(kept, current.scribbles),
              pending: toPending(batch, transcriptRef.current.segments),
            }),
          });
          const body = (await res.json().catch(() => ({}))) as Partial<RefineResponse> & { error?: string };
          if (!res.ok) {
            setForgeError({
              message: body.error ?? "Forging failed.",
              needsKey: res.status === 401 || res.status === 403,
            });
            break;
          }

          const before = new Map(base.notes.map((n) => [n.id, n.text]));
          const notes = applyRefine(kept, batch, body.items ?? [], body.moves ?? []);
          base = { notes, updatedAt: Date.now() };
          done += batch.length;
          const fresh = new Set(notes.filter((n) => before.get(n.id) !== n.text).map((n) => n.id));
          setFreshIds(fresh);
          const committed = base;
          setSession((s) => (s && s.video.id === forVideo ? { ...s, doc: committed } : s));
        }
      } catch {
        setForgeError({ message: "Couldn't reach the NoteSmith server.", needsKey: false });
      } finally {
        forgingRef.current = false;
        setForging(false);
        setProgress(null);
      }
    },
    [],
  );

  // Auto-forge a few seconds after the scribbles settle.
  useEffect(() => {
    if (!settings.autoForge || !canForge || forgeError) return;
    const t = setTimeout(() => forge("new"), AUTO_FORGE_DELAY_MS);
    return () => clearTimeout(t);
  }, [settings.autoForge, canForge, forgeError, scribbles, forge]);

  /* ---------- scribble actions ---------- */

  const addScribble = useCallback((text: string, at: number) => {
    const id = newId("s");
    setSession((s) =>
      s ? { ...s, scribbles: [...s.scribbles, { id, text, time: Math.max(0, at), createdAt: Date.now() }] } : s,
    );
    setLastAddedId(id);
  }, []);

  const editScribble = useCallback((id: string, text: string) => {
    setSession((s) => (s ? { ...s, scribbles: s.scribbles.map((x) => (x.id === id ? { ...x, text } : x)) } : s));
  }, []);

  const undoRef = useRef<(() => void) | null>(null);

  const deleteScribble = useCallback(
    (id: string) => {
      const s = sessionRef.current;
      if (!s) return;
      const snapshot = { scribbles: s.scribbles, doc: s.doc };
      const scribblesLeft = s.scribbles.filter((x) => x.id !== id);
      const remaining = new Set(scribblesLeft.map((x) => x.id));
      // A note made only from deleted scribbles goes right away; a note that
      // still has other scribbles waits to be re-forged.
      const notes = s.doc.notes.filter((n) => Object.keys(n.sources).some((sid) => remaining.has(sid)));
      setSession({ ...s, scribbles: scribblesLeft, doc: { ...s.doc, notes } });
      setHoverIds(new Set());
      // The row is gone; don't leave keyboard focus on nothing.
      requestAnimationFrame(() => composerRef.current?.focus());
      const undo = () => {
        undoRef.current = null;
        setSession((cur) =>
          cur && cur.video.id === s.video.id ? { ...cur, scribbles: snapshot.scribbles, doc: snapshot.doc } : cur,
        );
      };
      undoRef.current = undo;
      setTimeout(() => {
        if (undoRef.current === undo) undoRef.current = null;
      }, 10000);
      show({ text: "Scribble deleted", action: { label: "Undo", run: undo } });
    },
    [show],
  );

  const seek = useCallback((t: number) => playerRef.current?.seekTo(t), []);
  const getTime = useCallback(() => playerRef.current?.getTime() ?? 0, []);
  const pauseVideo = useCallback(() => playerRef.current?.pause(), []);
  const onHover = useCallback((ids: string[] | null) => setHoverIds(new Set(ids ?? [])), []);

  /* ---------- export ---------- */

  const markdown = useCallback(() => {
    const s = sessionRef.current!;
    return toMarkdown(s.doc, s.scribbles, s.video, {
      includeScribbles: true,
      includeContext: settingsRef.current.showContext,
    });
  }, []);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(markdown());
      show({ text: "Copied the notes as Markdown" });
    } catch {
      show({ text: "Couldn't copy. Your browser blocked clipboard access.", tone: "error" });
    }
  }, [markdown, show]);

  const download = useCallback(() => {
    const s = sessionRef.current!;
    const name =
      (s.video.title ?? s.video.id)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60) || "notes";
    const url = URL.createObjectURL(new Blob([markdown()], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    show({ text: `Downloaded ${name}.md` });
  }, [markdown, show]);

  /* ---------- keyboard ---------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest?.("input, textarea, [contenteditable]");
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (canForge) forge("new");
      } else if (!typing && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && undoRef.current) {
        e.preventDefault();
        undoRef.current();
      } else if (!typing && e.key === "/" && session) {
        e.preventDefault();
        composerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canForge, forge, session]);

  /* ---------- settings ---------- */

  const updateSettings = useCallback((s: Settings) => {
    const before = settingsRef.current;
    const keyChanged =
      s.provider !== before.provider ||
      s.models[s.provider] !== before.models[before.provider] ||
      s.apiKeys[s.provider] !== before.apiKeys[before.provider];
    setSettings(s);
    saveSettings(s);
    if (keyChanged) setForgeError(null);
  }, []);

  /* ---------- render ---------- */

  if (!hydrated) return <div className="h-full bg-canvas" />;

  const settingsDialog = (
    <SettingsDialog
      open={settingsOpen}
      settings={settings}
      serverKey={serverKey}
      onSave={updateSettings}
      onClose={() => setSettingsOpen(false)}
    />
  );

  if (!session) {
    return (
      <>
        <Welcome
          sessions={sessions}
          needsKey={!hasKey}
          error={openError}
          onOpen={openVideo}
          onForget={(id) => {
            deleteSession(id);
            setSessions(listSessions());
          }}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        {settingsDialog}
        <Toasts toasts={toasts} dismiss={dismiss} />
      </>
    );
  }

  const player = (
    <div className="h-full overflow-hidden rounded-md border border-border bg-sunken">
      <Player
        ref={playerRef}
        videoId={session.video.id}
        startAt={scribbles.length ? Math.max(...scribbles.map((s) => s.time)) : 0}
        onTime={setTime}
      />
    </div>
  );
  const transcriptPanel = (
    <TranscriptPanel
      segments={transcript.segments}
      time={time}
      status={transcript.status}
      message={transcript.message}
      onSeek={seek}
    />
  );
  const scribblesPanel = (
    <ScribblesPanel
      scribbles={scribbles}
      pendingIds={pendingIds}
      highlightIds={hoverIds}
      lastAddedId={lastAddedId}
      time={time}
      enabled
      composerRef={composerRef}
      getTime={getTime}
      pauseVideo={pauseVideo}
      onAdd={addScribble}
      onEdit={editScribble}
      onDelete={deleteScribble}
      onSeek={seek}
      onHover={onHover}
    />
  );
  const docPanel = (
    <DocPanel
      doc={doc}
      scribbles={scribbles}
      forging={forging}
      progress={progress}
      error={forgeError ?? (!hasKey && needsWork ? { message: "Add an API key in Settings to start forging.", needsKey: true } : null)}
      waiting={pendingIds.size}
      canForge={canForge}
      autoForge={settings.autoForge}
      freshIds={freshIds}
      staleIds={staleIds}
      showContext={settings.showContext}
      highlightIds={hoverIds}
      onForge={() => forge("new")}
      onReforgeAll={() => forge("all")}
      onCopy={copy}
      onDownload={download}
      onSeek={seek}
      onHover={onHover}
      onOpenSettings={() => setSettingsOpen(true)}
    />
  );

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 px-3">
        <button
          type="button"
          onClick={closeVideo}
          className="shrink-0 font-pixel text-[18px] text-ink transition-colors hover:text-accent"
          style={{ transitionDuration: "var(--duration)" }}
          title="Back to the start page"
        >
          NoteSmith
        </button>
        <span className="h-5 w-px bg-border" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-body" title={session.video.title ?? undefined}>
          <span className="text-ink">{session.video.title ?? "Loading video…"}</span>
          {session.video.author && <span className="text-faint"> · {session.video.author}</span>}
        </p>
        <button type="button" className="btn btn-secondary shrink-0" onClick={closeVideo}>
          <span className="hidden sm:inline">Change video</span>
          <span className="sm:hidden">Change</span>
        </button>
        {(!hasKey || forgeError?.needsKey) && (
          <button
            type="button"
            className={`btn btn-secondary shrink-0 ${hasKey ? "text-danger" : "text-accent"}`}
            onClick={() => setSettingsOpen(true)}
            aria-label={hasKey ? "Fix API key" : "Add API key"}
          >
            <KeyIcon size={15} />
            <span className="hidden sm:inline">{hasKey ? "Fix API key" : "Add API key"}</span>
          </button>
        )}
        <button
          type="button"
          className="btn-icon shrink-0"
          onClick={() => setSettingsOpen(true)}
          title="Settings"
          aria-label="Settings"
        >
          <SettingsIcon size={18} />
        </button>
      </header>

      <main className="min-h-0 flex-1 px-2 pb-2">
        {narrow ? (
          <div className="flex h-full flex-col gap-2 overflow-y-auto">
            <div className="sticky top-0 z-10 aspect-video w-full shrink-0 bg-canvas">{player}</div>
            <div className="h-[380px] shrink-0">{scribblesPanel}</div>
            <div className="h-[560px] shrink-0">{docPanel}</div>
            <div className="h-[360px] shrink-0">{transcriptPanel}</div>
          </div>
        ) : (
          <PanelGroup direction="vertical" autoSaveId="notesmith-rows">
            <Panel defaultSize={46} minSize={25}>
              <PanelGroup direction="horizontal" autoSaveId="notesmith-top">
                <Panel defaultSize={60} minSize={30}>
                  {player}
                </Panel>
                <Handle direction="horizontal" />
                <Panel defaultSize={40} minSize={20}>
                  {transcriptPanel}
                </Panel>
              </PanelGroup>
            </Panel>
            <Handle direction="vertical" />
            <Panel defaultSize={54} minSize={25}>
              <PanelGroup direction="horizontal" autoSaveId="notesmith-bottom">
                <Panel defaultSize={42} minSize={25}>
                  {scribblesPanel}
                </Panel>
                <Handle direction="horizontal" />
                <Panel defaultSize={58} minSize={30}>
                  {docPanel}
                </Panel>
              </PanelGroup>
            </Panel>
          </PanelGroup>
        )}
      </main>

      {settingsDialog}
      <Toasts toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
