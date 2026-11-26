/**
 * NoteSmith domain types.
 *
 * The Living Document is built from notes. Every note is the refined form of
 * one or more of the user's scribbles, and remembers exactly which scribbles
 * (and which text of those scribbles) it was made from. That link is what lets
 * the app keep notes stable, refine only what changed, and guarantee that no
 * scribble is ever dropped.
 */

/** One caption line. Times are in seconds. */
export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

/** A raw thought, stamped with the video time it was written at. */
export interface Scribble {
  id: string;
  text: string;
  /** Playback time in seconds when the scribble was started. */
  time: number;
  createdAt: number;
}

/**
 * What the AI adds under a note, always shown apart from the user's words:
 * - video: what the speakers said that the note refers to;
 * - answer: the video's answer to the user's question;
 * - general: an answer from the model's general knowledge (not the video).
 */
export type DetailKind = "video" | "answer" | "general";

export interface NoteDetail {
  kind: DetailKind;
  text: string;
  /** Where in the video it comes from, in seconds (video and answer only). */
  at?: number;
}

/** A refined note in the Living Document. */
export interface Note {
  id: string;
  /** Short inline markdown: the user's own thought, made readable and self-contained. */
  text: string;
  /** Background from the video, or an answer, shown under the note. */
  detail?: NoteDetail;
  /** Topic heading this note sits under. Empty string means no heading. */
  topic: string;
  /** The scribbles this note was made from, with their text at that moment. */
  sources: Record<string, string>;
  /** True when the AI could not refine it and the raw text was kept as-is. */
  unrefined?: boolean;
}

export interface LivingDocument {
  notes: Note[];
  updatedAt: number | null;
}

export type Provider = "anthropic" | "openai";

export interface Settings {
  provider: Provider;
  /** Model id per provider, so switching provider doesn't lose a choice. */
  models: Record<Provider, string>;
  /** Keys live only in this browser. Empty means "use the server's key". */
  apiKeys: Record<Provider, string>;
  autoForge: boolean;
}

export interface VideoInfo {
  id: string;
  title: string | null;
  author: string | null;
}

/** Everything saved for one video. */
export interface Session {
  video: VideoInfo;
  scribbles: Scribble[];
  doc: LivingDocument;
  lastOpenedAt: number;
}

/* ---------- Refine API contract (browser <-> server) ---------- */

/** A scribble that needs refining. */
export interface PendingScribble {
  id: string;
  time: number;
  text: string;
}

/** An existing note, as the model sees it. */
export interface ExistingNote {
  id: string;
  topic: string;
  text: string;
  times: number[];
  /** The scribbles behind it, as the writer typed them. */
  written: string[];
  detail?: NoteDetail;
}

export interface RefineRequest {
  provider: Provider;
  model: string;
  video: { title: string | null; author: string | null };
  /** The video's transcript as timestamped paragraphs (see transcriptForPrompt). */
  transcript: string;
  notes: ExistingNote[];
  pending: PendingScribble[];
}

/** One instruction from the model: a new note, or a merge into an existing one. */
export interface RefineItem {
  sourceIds: string[];
  text: string;
  topic: string;
  mergeInto: string | null;
  detail: NoteDetail | null;
}

/** Move an existing note to another topic. Its text never changes. */
export interface TopicMove {
  noteId: string;
  topic: string;
}

export interface RefineResponse {
  items: RefineItem[];
  moves: TopicMove[];
  /** Pending ids the model failed to cover even after a retry. */
  missing: string[];
  usage: { inputTokens: number; outputTokens: number; cachedTokens?: number };
}
