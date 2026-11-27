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
  /** In a "steps" document: an action to take, numbered in order. Tips, whys and questions are not steps. */
  step?: boolean;
}

/**
 * How the notes are laid out, guessed from how the writer writes, never
 * from the kind of video:
 * - steps: numbered steps in order, grouped by stage (a recipe, a method);
 * - topics: notes grouped by theme (ideas, explanations, opinions).
 */
export type DocShape = "steps" | "topics";

/** How a version of the document came about, for the history list. */
export type DocOrigin = "forge" | "reforge" | "restore";

export interface LivingDocument {
  notes: Note[];
  updatedAt: number | null;
  /** Missing means "topics" (documents from before shapes existed). */
  shape?: DocShape;
  madeBy?: DocOrigin;
}

/** An earlier version of the Living Document, kept so any change can be undone. */
export interface DocVersion {
  id: string;
  doc: LivingDocument;
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
  /** What the writer says these notes are for, e.g. "the science behind each technique". Optional. */
  purpose?: string;
  /** Earlier versions of the document, oldest first. */
  history?: DocVersion[];
  /** Tokens forging this video has used so far. */
  tokens?: TokenUse;
  /** The writer undid a change of shape: keep the current one until they ask for a re-forge. */
  keepShape?: boolean;
  lastOpenedAt: number;
}

/* ---------- Forging: what goes to the model and what comes back ---------- */

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
  step?: boolean;
}

export interface RefineRequest {
  provider: Provider;
  model: string;
  video: { title: string | null; author: string | null };
  /** The video's transcript as timestamped paragraphs (see transcriptForPrompt). */
  transcript: string;
  notes: ExistingNote[];
  pending: PendingScribble[];
  /** What the writer says the notes are for, if they said. */
  purpose?: string;
  /** The document's shape so far (null: not decided yet). */
  shape?: DocShape | null;
  /** True: use `shape` as given. False: the model may change it. */
  shapeFixed?: boolean;
}

/** One instruction from the model: a new note, or a merge into an existing one. */
export interface RefineItem {
  sourceIds: string[];
  text: string;
  topic: string;
  mergeInto: string | null;
  detail: NoteDetail | null;
  /** An action to take, in a "steps" document. */
  step?: boolean;
}

/** Move an existing note to another topic. Its text never changes. */
export interface TopicMove {
  noteId: string;
  topic: string;
}

export interface RefineResponse {
  /** The shape the model chose for the whole document. */
  shape: DocShape;
  items: RefineItem[];
  moves: TopicMove[];
  /** Pending ids the model failed to cover even after a retry. */
  missing: string[];
  usage: { inputTokens: number; outputTokens: number; cachedTokens: number; cacheWriteTokens: number; calls: number };
}

/** Tokens forging one video has used so far. */
export interface TokenUse {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  cacheWriteTokens: number;
  /** Model calls made. */
  calls: number;
}
