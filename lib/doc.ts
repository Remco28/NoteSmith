/**
 * Living Document logic. Pure functions, no I/O, shared by the browser,
 * the server and the eval scripts.
 *
 * The rules that keep the user's scribbles safe live here, in code, not in
 * the prompt:
 * - every non-empty scribble ends up in exactly one note;
 * - a note is only rewritten when one of its scribbles changes or a new
 *   scribble is merged into it;
 * - if the model leaves a scribble out, the raw text is kept as a note.
 */

import type {
  ExistingNote,
  LivingDocument,
  Note,
  PendingScribble,
  RefineItem,
  Scribble,
  TopicMove,
  TranscriptSegment,
} from "@/types/notesmith";

export const emptyDocument = (): LivingDocument => ({ notes: [], updatedAt: null });

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Split the document into notes that are still valid and scribbles that need
 * (re)refining. A note is stale when any scribble it came from was deleted,
 * emptied or edited; its scribbles then go back to pending.
 */
export function planRefine(
  scribbles: Scribble[],
  doc: LivingDocument,
): { kept: Note[]; pending: Scribble[] } {
  const live = new Map<string, Scribble>();
  for (const s of scribbles) {
    if (s.text.trim()) live.set(s.id, s);
  }

  const kept: Note[] = [];
  const covered = new Set<string>();

  for (const note of doc.notes) {
    const ids = Object.keys(note.sources);
    const intact =
      ids.length > 0 && ids.every((id) => live.has(id) && live.get(id)!.text === note.sources[id]);
    if (intact) {
      kept.push(note);
      ids.forEach((id) => covered.add(id));
    }
  }

  const pending = scribbles
    .filter((s) => live.has(s.id) && !covered.has(s.id))
    .sort((a, b) => a.time - b.time);

  return { kept, pending };
}

/** True when the document is out of date with the scribbles. */
export function needsRefine(scribbles: Scribble[], doc: LivingDocument): boolean {
  const { kept, pending } = planRefine(scribbles, doc);
  return pending.length > 0 || kept.length !== doc.notes.length;
}

/** Scribble ids whose current text is already reflected in a note. */
export function forgedIds(scribbles: Scribble[], doc: LivingDocument): Set<string> {
  const { kept } = planRefine(scribbles, doc);
  const ids = new Set<string>();
  for (const note of kept) Object.keys(note.sources).forEach((id) => ids.add(id));
  return ids;
}

/* ---------- Transcript context ---------- */

const CONTEXT_BEFORE_S = 75;
const CONTEXT_AFTER_S = 10;
const CONTEXT_MAX_CHARS = 1400;
const RECENT_BEFORE_S = 15;
const RECENT_AFTER_S = 0;

/**
 * The transcript around one moment: by default the ~75 seconds before the
 * scribble and a few seconds after.
 */
export function transcriptAround(
  segments: TranscriptSegment[],
  time: number,
  before = CONTEXT_BEFORE_S,
  after = CONTEXT_AFTER_S,
): string {
  const from = time - before;
  const to = time + after;
  let text = segments
    .filter((s) => s.end >= from && s.start <= to)
    .map((s) => s.text.replace(/\s+/g, " ").trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length > CONTEXT_MAX_CHARS) {
    // Keep the end: the words right before the scribble matter most.
    text = "…" + text.slice(text.length - CONTEXT_MAX_CHARS);
  }
  return text;
}

export function toPending(scribbles: Scribble[], segments: TranscriptSegment[]): PendingScribble[] {
  return scribbles.map((s) => ({
    id: s.id,
    time: s.time,
    text: s.text.trim(),
    context: transcriptAround(segments, s.time),
    recent: transcriptAround(segments, s.time, RECENT_BEFORE_S, RECENT_AFTER_S),
  }));
}

export function noteTimes(note: Note, scribbles: Scribble[]): number[] {
  const byId = new Map(scribbles.map((s) => [s.id, s]));
  return Object.keys(note.sources)
    .map((id) => byId.get(id)?.time)
    .filter((t): t is number => typeof t === "number")
    .sort((a, b) => a - b);
}

export function toExistingNotes(notes: Note[], scribbles: Scribble[]): ExistingNote[] {
  return notes.map((n) => ({ id: n.id, topic: n.topic, text: n.text, times: noteTimes(n, scribbles) }));
}

/* ---------- Applying the model's answer ---------- */

function cleanText(text: string): string {
  return text
    .replace(/^\s*[-*•]\s+/, "") // a stray leading bullet
    .replace(/^#+\s+/, "") // a stray heading marker
    .trim();
}

function cleanContext(context: string | null | undefined): string | undefined {
  const c = (context ?? "")
    .trim()
    .replace(/^[("']+|[)"']+$/g, "")
    .replace(/^\s*(re:|context:)\s*/i, "")
    .trim();
  return c ? c.slice(0, 140) : undefined;
}

function cleanTopic(topic: string): string {
  return topic.replace(/^#+\s*/, "").replace(/[.:]+$/, "").trim().slice(0, 60);
}

/**
 * Merge the model's items into the kept notes. Anything the model got wrong
 * (unknown ids, a scribble used twice, a merge into a note that does not
 * exist) is corrected here, and scribbles it left out become raw notes.
 */
export function applyRefine(
  kept: Note[],
  pending: Scribble[],
  items: RefineItem[],
  moves: TopicMove[] = [],
): Note[] {
  const pendingById = new Map(pending.map((s) => [s.id, s]));
  const used = new Set<string>();
  const notes = kept.map((n) => ({ ...n, sources: { ...n.sources } }));
  const noteById = new Map(notes.map((n) => [n.id, n]));

  for (const move of moves) {
    const note = noteById.get(move.noteId);
    const topic = cleanTopic(move.topic ?? "");
    if (note && topic) note.topic = topic;
  }

  for (const item of items) {
    const ids = item.sourceIds.filter((id) => pendingById.has(id) && !used.has(id));
    const text = cleanText(item.text ?? "");
    if (ids.length === 0 || !text) continue;
    ids.forEach((id) => used.add(id));

    const sources: Record<string, string> = {};
    for (const id of ids) sources[id] = pendingById.get(id)!.text;
    const context = cleanContext(item.context);

    const target = item.mergeInto ? noteById.get(item.mergeInto) : undefined;
    if (target) {
      target.text = text;
      // The merged note's aside is whatever the model gives now; an old
      // aside may no longer fit the new text.
      target.context = context;
      target.sources = { ...target.sources, ...sources };
      target.unrefined = false;
      if (item.topic && cleanTopic(item.topic)) target.topic = cleanTopic(item.topic);
    } else {
      const note: Note = { id: newId("n"), text, topic: cleanTopic(item.topic ?? ""), sources };
      if (context) note.context = context;
      notes.push(note);
      noteById.set(note.id, note);
    }
  }

  for (const s of pending) {
    if (!used.has(s.id)) {
      notes.push({
        id: newId("n"),
        text: s.text.trim(),
        topic: "",
        sources: { [s.id]: s.text },
        unrefined: true,
      });
    }
  }

  return notes;
}

/* ---------- Reading order ---------- */

export interface TopicSection {
  topic: string;
  notes: Array<{ note: Note; times: number[] }>;
}

/**
 * Group notes by topic. Topics appear in the order they first came up in the
 * video, and notes within a topic follow the video too.
 */
export function sections(doc: LivingDocument, scribbles: Scribble[]): TopicSection[] {
  const byTopic = new Map<string, TopicSection>();
  const firstTime = new Map<string, number>();

  for (const note of doc.notes) {
    const times = noteTimes(note, scribbles);
    const key = note.topic.trim().toLowerCase();
    if (!byTopic.has(key)) byTopic.set(key, { topic: note.topic.trim(), notes: [] });
    byTopic.get(key)!.notes.push({ note, times });
    const t = times[0] ?? Number.MAX_SAFE_INTEGER;
    firstTime.set(key, Math.min(firstTime.get(key) ?? Number.MAX_SAFE_INTEGER, t));
  }

  for (const section of byTopic.values()) {
    section.notes.sort((a, b) => (a.times[0] ?? 0) - (b.times[0] ?? 0));
  }

  return [...byTopic.entries()]
    .sort((a, b) => firstTime.get(a[0])! - firstTime.get(b[0])!)
    .map(([, s]) => s);
}

/* ---------- Export ---------- */

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function videoLink(videoId: string, seconds: number): string {
  return `https://youtu.be/${videoId}?t=${Math.floor(seconds)}`;
}

export function toMarkdown(
  doc: LivingDocument,
  scribbles: Scribble[],
  video: { id: string; title: string | null },
  options: { includeScribbles?: boolean; includeContext?: boolean } = {},
): string {
  const lines: string[] = [];
  const title = video.title ?? video.id;
  lines.push(`# ${title}`, "", `<https://www.youtube.com/watch?v=${video.id}>`, "");

  for (const section of sections(doc, scribbles)) {
    if (section.topic) lines.push(`## ${section.topic}`, "");
    for (const { note, times } of section.notes) {
      const stamps = times.map((t) => `[${formatTime(t)}](${videoLink(video.id, t)})`).join(", ");
      const context = note.context && options.includeContext !== false ? ` *(re: “${note.context}”)*` : "";
      lines.push(`- ${note.text}${context}${stamps ? ` (${stamps})` : ""}`);
    }
    lines.push("");
  }

  if (options.includeScribbles && scribbles.length > 0) {
    lines.push("---", "", "## Raw scribbles", "");
    for (const s of [...scribbles].sort((a, b) => a.time - b.time)) {
      if (s.text.trim()) lines.push(`- ${formatTime(s.time)} ${s.text.trim().replace(/\n+/g, " ")}`);
    }
    lines.push("");
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
