"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import {
  applyRefine,
  emptyDocument,
  forgedIds,
  newId,
  planRefine,
  pushVersion,
  toExistingNotes,
  toMarkdown,
  toPending,
  transcriptForPrompt,
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
import { IMPORT_PREFIX, readImport } from "@/lib/bookmarklet";
import { LlmError } from "@/lib/llm/types";
import { refine } from "@/lib/refine/run";
import { fetchVideoInfo } from "@/lib/video-info";
import type {
  DocShape,
  LivingDocument,
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

/** Why everything is being re-forged; it decides the shape and what the Undo message says. */
type ReforgeReason =
  | { kind: "button" }
  | { kind: "shape"; shape: DocShape }
  | { kind: "purpose"; purpose: string };

function reforgeMessage(why: ReforgeReason): string {
  if (why.kind === "shape") {
    return why.shape === "steps"
      ? "Your scribbles read like steps now, so the notes became numbered steps"
      : "Your scribbles read like ideas, not steps, so the notes are grouped by topic";
  }
  if (why.kind === "purpose") return `Re-forged the notes for “${why.purpose}”`;
  return "Re-forged all your notes";
}

type TranscriptState = {
  /** missing: not loaded yet; the bookmark loads it. unavailable: the bookmark found none. */
  status: "loading" | "ready" | "missing" | "unavailable";
  segments: TranscriptSegment[];
  message: string | null;
};

const EMPTY: Set<string> = new Set();

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
  // Which panel the pointer (or keyboard focus) is in: the other one follows it.
  const [hoverFrom, setHoverFrom] = useState<"scribbles" | "doc" | null>(null);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // An earlier version of the document being looked at (its id in the history).
  const [previewId, setPreviewId] = useState<string | null>(null);
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
  // What Ctrl+Z (or a toast's Undo) undoes right now, if anything.
  const undoRef = useRef<(() => void) | null>(null);
  // What the bookmark just brought in, kept here too in case storage is full.
  const importedRef = useRef<{ id: string; segments: TranscriptSegment[] } | null>(null);

  /* ---------- load ---------- */

  useEffect(() => {
    setSettings(loadSettings());
    setSessions(listSessions());
    (async () => {
      // Arriving from the NoteSmith bookmark: the video and its transcript are in the hash.
      const hash = window.location.hash;
      const imported = hash.startsWith(IMPORT_PREFIX) ? await readImport(hash) : null;
      if (hash.startsWith(IMPORT_PREFIX)) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
      if (imported) {
        const segments = imported.segments.filter((x) => x.text.trim());
        importedRef.current = { id: imported.id, segments };
        if (segments.length) saveTranscript(imported.id, segments);
        const s = loadSession(imported.id) ?? newSession(imported.id);
        const opened: Session = {
          ...s,
          video: { ...s.video, title: imported.title ?? s.video.title, author: imported.author ?? s.video.author },
          lastOpenedAt: Date.now(),
        };
        saveSession(opened);
        saveCurrentVideoId(imported.id);
        setSession(opened);
      } else {
        if (hash.startsWith(IMPORT_PREFIX)) setOpenError("That link from the bookmark was damaged. Click the bookmark again.");
        const current = loadCurrentVideoId();
        const saved = current ? loadSession(current) : null;
        if (saved) setSession({ ...saved, lastOpenedAt: Date.now() });
      }
      setHydrated(true);
    })();
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
    const imported = importedRef.current?.id === videoId ? importedRef.current : null;
    const segments = imported?.segments.length ? imported.segments : loadTranscript(videoId);
    if (segments?.length) setTranscript({ status: "ready", segments, message: null });
    else if (imported) setTranscript({ status: "unavailable", segments: [], message: null });
    else setTranscript({ status: "missing", segments: [], message: null });

    if (sessionRef.current?.video.title) return;
    let cancelled = false;
    fetchVideoInfo(videoId).then((info) => {
      if (cancelled || (!info.title && !info.author)) return;
      setSession((s) =>
        s && s.video.id === videoId
          ? { ...s, video: { ...s.video, title: info.title ?? s.video.title, author: info.author ?? s.video.author } }
          : s,
      );
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
    setPreviewId(null);
  }, []);

  const closeVideo = useCallback(() => {
    if (sessionRef.current) saveSession(sessionRef.current);
    saveCurrentVideoId(null);
    setSession(null);
    setPreviewId(null);
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
  const hasKey = Boolean(settings.apiKeys[settings.provider]?.trim());
  const needsWork = plan.pending.length > 0 || staleIds.size > 0;
  const canForge = Boolean(session) && hasKey && !forging && needsWork;

  /* ---------- forging ---------- */

  const forgeRef = useRef<(mode?: "new" | "all", why?: ReforgeReason) => Promise<void>>(async () => {});
  // A re-forge asked for while another forge was running; it runs next.
  const queuedRef = useRef<ReforgeReason | null>(null);
  // The document the last forge saved. React applies it on its next render, so a
  // forge that starts right after another waits for it instead of reading the old one.
  const committedRef = useRef<LivingDocument | null>(null);

  /** Put an earlier version back. The version being replaced goes into the history, so this can be undone too. */
  const restoreDoc = useCallback((doc: LivingDocument) => {
    setSession((s) =>
      s ? { ...s, doc: { ...doc, madeBy: "restore", updatedAt: Date.now() }, history: pushVersion(s.history, s.doc) } : s,
    );
    setFreshIds(new Set());
    setPreviewId(null);
  }, []);

  const forge = useCallback(
    async (mode: "new" | "all" = "new", why: ReforgeReason = { kind: "button" }) => {
      if (!sessionRef.current) return;
      if (forgingRef.current) {
        if (mode === "all") queuedRef.current = why;
        return;
      }
      forgingRef.current = true;
      setForging(true);
      setForgeError(null);
      const forVideo = sessionRef.current.video.id;
      // Notes are filled in from the transcript, so give it a moment to arrive.
      for (let i = 0; i < 40 && transcriptRef.current.status === "loading"; i++) {
        await new Promise((r) => setTimeout(r, 250));
      }
      for (let i = 0; i < 100 && committedRef.current && sessionRef.current?.doc !== committedRef.current; i++) {
        await new Promise((r) => setTimeout(r, 20));
      }
      committedRef.current = null;
      if (!sessionRef.current || sessionRef.current.video.id !== forVideo) {
        forgingRef.current = false;
        setForging(false);
        return;
      }
      // Kept so this whole run can be undone, and added to the history once it changes anything.
      const before = sessionRef.current.doc;
      let base: LivingDocument = mode === "all" ? emptyDocument() : before;
      const total = planRefine(sessionRef.current.scribbles, base).pending.length;
      let done = 0;
      let saved = false;
      let finished = false;
      // The shape: a re-forge for a new shape uses it; otherwise the model may choose,
      // and after the first batch of a run it stays put.
      let shape: DocShape | null =
        mode === "all" ? (why.kind === "shape" ? why.shape : null) : before.notes.length ? (before.shape ?? "topics") : null;
      let shapeFixed =
        (mode === "all" && why.kind === "shape") ||
        (mode === "new" && shape !== null && Boolean(sessionRef.current.keepShape));
      // Asking for a re-forge lets NoteSmith choose the shape again.
      if (mode === "all" && why.kind !== "shape" && sessionRef.current.keepShape) {
        setSession((s) => (s && s.video.id === forVideo ? { ...s, keepShape: false } : s));
      }
      // A forge that finds the notes have become a different shape re-forges everything in it.
      let reshapeTo: DocShape | null = null;

      try {
        for (let round = 0; round < Math.ceil(total / BATCH) + 3; round++) {
          const current = sessionRef.current;
          if (!current || current.video.id !== forVideo) return;
          const { kept, pending } = planRefine(current.scribbles, base);
          if (pending.length === 0) {
            const finalDoc: LivingDocument = { ...base, notes: kept, updatedAt: Date.now() };
            committedRef.current = finalDoc;
            setSession((s) => (s && s.video.id === forVideo ? { ...s, doc: finalDoc } : s));
            finished = true;
            break;
          }
          const batch = pending.slice(0, BATCH);
          // Read settings per batch, so a change mid-run applies to the next request.
          const cfg = settingsRef.current;
          // Notes present now; anything that appears while we wait (an undo) is kept.
          const startIds = new Set(current.doc.notes.map((n) => n.id));
          setProgress(total > BATCH ? `Forging ${Math.min(done + batch.length, total)} of ${total}…` : "Forging…");

          const key = cfg.apiKeys[cfg.provider]?.trim();
          if (!key) {
            setForgeError({ message: "Add your API key in Settings to start forging.", needsKey: true });
            break;
          }
          let body: RefineResponse;
          try {
            // Straight from this browser to the provider; there is no NoteSmith server.
            body = await refine(
              {
                provider: cfg.provider,
                model: cfg.models[cfg.provider],
                video: { title: current.video.title, author: current.video.author },
                notes: toExistingNotes(kept, current.scribbles),
                pending: toPending(batch),
                purpose: current.purpose,
                shape,
                shapeFixed,
                transcript: transcriptForPrompt(
                  transcriptRef.current.segments,
                  batch.map((s) => s.time),
                ),
              },
              key,
            );
          } catch (error) {
            // An answer for settings that have since changed says nothing about the new ones.
            const now = settingsRef.current;
            const changed =
              now.provider !== cfg.provider ||
              now.models[now.provider] !== cfg.models[cfg.provider] ||
              now.apiKeys[now.provider] !== cfg.apiKeys[cfg.provider];
            if (changed) break;
            const status = error instanceof LlmError ? error.status : 0;
            setForgeError({
              message: error instanceof LlmError ? error.message : "Something went wrong while forging.",
              needsKey: status === 401 || status === 403,
            });
            break;
          }

          if (!shapeFixed) {
            // Notes already there were written for the old shape: re-forge them all for the new one.
            if (mode === "new" && kept.length > 0 && shape && body.shape !== shape) reshapeTo = body.shape;
            else shape = body.shape;
            shapeFixed = true;
          }
          const docShape: DocShape = shape ?? body.shape;
          const textBefore = new Map(base.notes.map((n) => [n.id, n.text]));
          const notes = applyRefine(
            kept,
            batch,
            body.items ?? [],
            body.moves ?? [],
            transcriptRef.current.segments.at(-1)?.end,
            docShape,
          );
          const madeBy = mode === "all" ? "reforge" : "forge";
          base = { notes, updatedAt: Date.now(), shape: docShape, madeBy };
          done += batch.length;
          const fresh = new Set(notes.filter((n) => textBefore.get(n.id) !== n.text).map((n) => n.id));
          setFreshIds(fresh);
          const notesNow = sessionRef.current?.doc.notes ?? [];
          const ours = new Set(notes.map((n) => n.id));
          const arrived = notesNow.filter((n) => !startIds.has(n.id) && !ours.has(n.id));
          base = { ...base, notes: [...notes, ...arrived] };
          const committed = base;
          committedRef.current = committed;
          const first = !saved;
          saved = true;
          setSession((s) =>
            s && s.video.id === forVideo
              ? { ...s, doc: committed, history: first ? pushVersion(s.history, before) : s.history }
              : s,
          );
        }
      } catch {
        setForgeError({ message: "Something went wrong while forging.", needsKey: false });
      } finally {
        forgingRef.current = false;
        setForging(false);
        setProgress(null);
      }

      const sameVideo = sessionRef.current?.video.id === forVideo;
      if (sameVideo && finished && reshapeTo) {
        void forgeRef.current("all", { kind: "shape", shape: reshapeTo });
        return;
      }
      if (sameVideo && finished && mode === "all" && saved) {
        if (before.notes.length > 0) {
          const undo = () => {
            if (undoRef.current === undo) undoRef.current = null;
            restoreDoc(before);
            // Undoing a change of shape means "keep it the way it was": stop changing it on its own.
            if (why.kind === "shape") {
              setSession((s) => (s && s.video.id === forVideo ? { ...s, keepShape: true } : s));
            }
          };
          undoRef.current = undo;
          setTimeout(() => {
            if (undoRef.current === undo) undoRef.current = null;
          }, 10000);
          show({ text: reforgeMessage(why), action: { label: "Undo", run: undo } });
        }
      }
      const queued = queuedRef.current;
      queuedRef.current = null;
      if (sameVideo && queued) void forgeRef.current("all", queued);
    },
    [restoreDoc, show],
  );
  forgeRef.current = forge;

  // Auto-forge a few seconds after the scribbles settle.
  useEffect(() => {
    if (!settings.autoForge || !canForge || forgeError) return;
    const t = setTimeout(() => forge("new"), AUTO_FORGE_DELAY_MS);
    return () => clearTimeout(t);
  }, [settings.autoForge, canForge, forgeError, scribbles, forge]);

  /** Say what the notes are for. With notes already there, they're re-forged to fit. */
  const setPurpose = useCallback(
    (text: string) => {
      const s = sessionRef.current;
      if (!s) return;
      const purpose = text.trim().replace(/\s+/g, " ").slice(0, 200);
      if (purpose === (s.purpose ?? "")) return;
      const next: Session = { ...s, purpose: purpose || undefined };
      sessionRef.current = next;
      setSession(next);
      // Clearing it changes nothing on the page; the next forge goes back to guessing.
      if (purpose && next.doc.notes.length > 0) void forge("all", { kind: "purpose", purpose });
    },
    [forge],
  );

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

  const deleteScribble = useCallback(
    (id: string) => {
      const s = sessionRef.current;
      if (!s) return;
      const deleted = s.scribbles.find((x) => x.id === id);
      if (!deleted) return;
      const scribblesLeft = s.scribbles.filter((x) => x.id !== id);
      const remaining = new Set(scribblesLeft.map((x) => x.id));
      // A note made only from deleted scribbles goes right away; a note that
      // still has other scribbles waits to be re-forged.
      const notes = s.doc.notes.filter((n) => Object.keys(n.sources).some((sid) => remaining.has(sid)));
      const removedNotes = s.doc.notes.filter((n) => !notes.includes(n));
      setSession({ ...s, scribbles: scribblesLeft, doc: { ...s.doc, notes } });
      setHoverIds(new Set());
      // The row is gone; don't leave keyboard focus on nothing.
      requestAnimationFrame(() => composerRef.current?.focus());
      // Undo puts back only what this delete removed, on top of whatever has
      // happened since, so newer scribbles and notes are never lost.
      const undo = () => {
        if (undoRef.current === undo) undoRef.current = null;
        setSession((cur) => {
          if (!cur || cur.video.id !== s.video.id || cur.scribbles.some((x) => x.id === id)) return cur;
          const noteIds = new Set(cur.doc.notes.map((n) => n.id));
          const covered = new Set(cur.doc.notes.flatMap((n) => Object.keys(n.sources)));
          // A removed note comes back only if none of its scribbles is in a newer note.
          const restore = removedNotes.filter(
            (n) => !noteIds.has(n.id) && Object.keys(n.sources).every((sid) => !covered.has(sid)),
          );
          return {
            ...cur,
            scribbles: [...cur.scribbles, deleted],
            doc: { ...cur.doc, notes: [...cur.doc.notes, ...restore] },
          };
        });
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
  const onHoverScribbles = useCallback((ids: string[] | null) => {
    setHoverIds(new Set(ids ?? []));
    setHoverFrom(ids ? "scribbles" : null);
  }, []);
  const onHoverDoc = useCallback((ids: string[] | null) => {
    setHoverIds(new Set(ids ?? []));
    setHoverFrom(ids ? "doc" : null);
  }, []);

  /* ---------- export ---------- */

  const previewIdRef = useRef(previewId);
  previewIdRef.current = previewId;
  const markdown = useCallback(() => {
    const s = sessionRef.current!;
    // Export what's on screen: an earlier version while one is being viewed.
    const shown = s.history?.find((v) => v.id === previewIdRef.current)?.doc ?? s.doc;
    return toMarkdown(shown, s.scribbles, s.video, {
      includeScribbles: true,
      purpose: s.purpose,
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
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "z" &&
        undoRef.current &&
        (!typing || (e.target === composerRef.current && !composerRef.current?.value))
      ) {
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
    setForgeError((err) => (err?.needsKey && !keyChanged ? err : null));
  }, []);

  /* ---------- render ---------- */

  if (!hydrated) return <div className="h-full bg-canvas" />;

  const settingsDialog = (
    <SettingsDialog
      open={settingsOpen}
      settings={settings}
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
      videoId={session.video.id}
      segments={transcript.segments}
      time={time}
      status={transcript.status}
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
      onHover={onHoverScribbles}
      follow={hoverFrom === "doc"}
    />
  );
  const history = session.history ?? [];
  const preview = previewId ? history.find((v) => v.id === previewId) ?? null : null;
  const docPanel = (
    <DocPanel
      doc={preview?.doc ?? doc}
      current={doc}
      history={history}
      previewing={preview}
      onPreview={setPreviewId}
      onRestore={(v) => restoreDoc(v.doc)}
      purpose={session.purpose ?? ""}
      onPurpose={setPurpose}
      scribbles={scribbles}
      forging={forging}
      progress={progress}
      error={forgeError ?? (!hasKey && needsWork ? { message: "Add an API key in Settings to start forging.", needsKey: true } : null)}
      waiting={pendingIds.size}
      canForge={canForge}
      autoForge={settings.autoForge}
      freshIds={preview ? EMPTY : freshIds}
      staleIds={preview ? EMPTY : staleIds}
      highlightIds={hoverIds}
      onForge={() => forge("new")}
      onReforgeAll={() => forge("all")}
      onCopy={copy}
      onDownload={download}
      onSeek={seek}
      onHover={onHoverDoc}
      follow={hoverFrom === "scribbles"}
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
            <div className="sticky top-0 z-10 aspect-video max-h-[40vh] w-full shrink-0 bg-canvas">{player}</div>
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
