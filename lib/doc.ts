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
  NoteDetail,
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

/* ---------- Transcript ---------- */

const PARAGRAPH_S = 30;
/** About 60k tokens: a 3-hour video fits whole. */
const TRANSCRIPT_MAX_CHARS = 240_000;

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Caption lines joined into paragraphs of about 30 seconds, each stamped with its start. */
function paragraphs(segments: TranscriptSegment[]): Array<{ start: number; text: string }> {
  const out: Array<{ start: number; text: string }> = [];
  for (const seg of segments) {
    const text = clean(seg.text);
    if (!text) continue;
    const last = out[out.length - 1];
    if (last && seg.start - last.start < PARAGRAPH_S) last.text += " " + text;
    else out.push({ start: seg.start, text });
  }
  return out;
}

/**
 * The transcript as the model reads it: "[m:ss] text" paragraphs. The whole
 * video when it fits, so a note can draw on what was said minutes earlier
 * and a question can be answered from later on. A very long video is cut to
 * a window around the scribbles.
 */
export function transcriptForPrompt(segments: TranscriptSegment[], times: number[]): string {
  const paras = paragraphs(segments).map((p) => ({ start: p.start, line: `[${formatTime(p.start)}] ${p.text}` }));
  const total = paras.reduce((n, p) => n + p.line.length + 1, 0);
  let chosen = paras;
  if (total > TRANSCRIPT_MAX_CHARS && times.length > 0) {
    // Grow a window around the scribbles until the budget is used.
    const lo = Math.min(...times);
    const hi = Math.max(...times);
    let pad = 0;
    for (let step = 60; ; step += 60) {
      const inside = paras.filter((p) => p.start >= lo - step && p.start <= hi + step);
      if (inside.reduce((n, p) => n + p.line.length + 1, 0) > TRANSCRIPT_MAX_CHARS || step > 4 * 3600) break;
      pad = step;
    }
    chosen = paras.filter((p) => p.start >= lo - pad && p.start <= hi + pad);
    if (chosen.length === 0) chosen = paras.filter((p) => p.start >= lo - 600 && p.start <= lo + 600);
  }
  return chosen.map((p) => p.line).join("\n");
}

/** The transcript around one moment (used by the eval's judge). */
export function transcriptAround(segments: TranscriptSegment[], time: number, before = 90, after = 30): string {
  return segments
    .filter((s) => s.end >= time - before && s.start <= time + after)
    .map((s) => clean(s.text))
    .join(" ");
}

export function toPending(scribbles: Scribble[]): PendingScribble[] {
  return scribbles.map((s) => ({ id: s.id, time: s.time, text: s.text.trim() }));
}

export function noteTimes(note: Note, scribbles: Scribble[]): number[] {
  const byId = new Map(scribbles.map((s) => [s.id, s]));
  return Object.keys(note.sources)
    .map((id) => byId.get(id)?.time)
    .filter((t): t is number => typeof t === "number")
    .sort((a, b) => a - b);
}

export function toExistingNotes(notes: Note[], scribbles: Scribble[]): ExistingNote[] {
  return notes.map((n) => ({
    id: n.id,
    topic: n.topic,
    text: n.text,
    times: noteTimes(n, scribbles),
    written: Object.values(n.sources),
    ...(n.detail ? { detail: n.detail } : {}),
  }));
}

/* ---------- Applying the model's answer ---------- */

function cleanText(text: string): string {
  return text
    .replace(/^\s*[-*•]\s+/, "") // a stray leading bullet
    .replace(/^#+\s+/, "") // a stray heading marker
    .trim();
}

const DETAIL_MAX_CHARS = 360;

/** Parse "m:ss" or "h:mm:ss" (or a number of seconds). */
export function parseTime(value: string | number | null | undefined): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : undefined;
  const m = (value ?? "").trim().replace(/^\[|\]$/g, "").match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  if (!m) return undefined;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/**
 * Tidy a detail from the model: drop empty ones, a label it wrote itself,
 * and anything past the length cap (cut at a sentence end where possible).
 * A time is kept only for details that come from the video.
 */
export function cleanDetail(detail: NoteDetail | null | undefined, videoEnd?: number): NoteDetail | undefined {
  if (!detail || !["video", "answer", "general"].includes(detail.kind)) return undefined;
  let text = (detail.text ?? "")
    .trim()
    .replace(/^\s*[-*•]\s+/, "")
    .replace(/^\(?(from the video|answer|general knowledge|context|re)\)?\s*[:—-]\s*/i, "")
    .trim();
  if (!text) return undefined;
  if (text.length > DETAIL_MAX_CHARS) {
    const cut = text.slice(0, DETAIL_MAX_CHARS);
    const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
    text = end > DETAIL_MAX_CHARS / 2 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, "") + "…";
  }
  const out: NoteDetail = { kind: detail.kind, text };
  if (detail.kind !== "general" && typeof detail.at === "number" && detail.at >= 0) {
    if (videoEnd === undefined || detail.at <= videoEnd + 5) out.at = Math.floor(detail.at);
  }
  return out;
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
  videoEnd?: number,
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
    const detail = cleanDetail(item.detail, videoEnd);

    const target = item.mergeInto ? noteById.get(item.mergeInto) : undefined;
    if (target) {
      target.text = text;
      // The merged note's detail is whatever the model gives now; the old
      // one may no longer fit the new text.
      if (detail) target.detail = detail;
      else delete target.detail;
      target.sources = { ...target.sources, ...sources };
      target.unrefined = false;
      if (item.topic && cleanTopic(item.topic)) target.topic = cleanTopic(item.topic);
    } else {
      const note: Note = { id: newId("n"), text, topic: cleanTopic(item.topic ?? ""), sources };
      if (detail) note.detail = detail;
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

export const DETAIL_LABEL: Record<NoteDetail["kind"], string> = {
  video: "From the video",
  answer: "Answer",
  general: "Answer, from general knowledge (not the video)",
};

export function videoLink(videoId: string, seconds: number): string {
  return `https://youtu.be/${videoId}?t=${Math.floor(seconds)}`;
}

export function toMarkdown(
  doc: LivingDocument,
  scribbles: Scribble[],
  video: { id: string; title: string | null },
  options: { includeScribbles?: boolean } = {},
): string {
  const lines: string[] = [];
  const title = video.title ?? video.id;
  lines.push(`# ${title}`, "", `<https://www.youtube.com/watch?v=${video.id}>`, "");

  for (const section of sections(doc, scribbles)) {
    if (section.topic) lines.push(`## ${section.topic}`, "");
    for (const { note, times } of section.notes) {
      const stamps = times.map((t) => `[${formatTime(t)}](${videoLink(video.id, t)})`).join(", ");
      lines.push(`- ${note.text}${stamps ? ` (${stamps})` : ""}`);
      if (note.detail) {
        const d = note.detail;
        const at = d.at !== undefined ? ` ([${formatTime(d.at)}](${videoLink(video.id, d.at)}))` : "";
        lines.push(`  - *${DETAIL_LABEL[d.kind]}${at}:* ${d.text.replace(/\n+/g, " ")}`);
      }
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
