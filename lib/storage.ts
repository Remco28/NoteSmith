/**
 * Browser persistence. Everything lives in localStorage:
 *   notesmith:settings          provider, models, API keys, preferences
 *   notesmith:current           id of the open video
 *   notesmith:session:<videoId> scribbles, Living Document and its history for one video
 *   notesmith:transcript:<id>   cached captions (only the most recent few)
 *
 * Every access is wrapped: private windows and full storage must never
 * break the app, they only mean nothing is remembered.
 */

import type { Session, Settings, TranscriptSegment } from "@/types/notesmith";

const PREFIX = "notesmith:";
const MAX_CACHED_TRANSCRIPTS = 6;

export const DEFAULT_MODELS = { anthropic: "claude-sonnet-5-5", openai: "gpt-5.4-mini" } as const;

/** Defaults from before version 3, when notes were only reworded. Filling in from the video needs a stronger model. */
const OLD_DEFAULT_MODELS: Record<string, string> = { anthropic: "claude-haiku-5-5", openai: "gpt-5.4-nano" };

export function defaultSettings(): Settings {
  return {
    provider: "anthropic",
    models: { ...DEFAULT_MODELS },
    apiKeys: { anthropic: "", openai: "" },
    autoForge: true,
  };
}

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

function keys(): string[] {
  try {
    return Object.keys(window.localStorage).filter((k) => k.startsWith(PREFIX)).map((k) => k.slice(PREFIX.length));
  } catch {
    return [];
  }
}

const SETTINGS_VERSION = 3;

export function loadSettings(): Settings {
  const saved = read<Partial<Settings> & { version?: number }>("settings");
  const base = defaultSettings();
  if (!saved) return base;
  if ((saved.version ?? 1) < 3 && saved.models) {
    // Someone still on the old default never chose it; move them to the new one.
    for (const p of ["anthropic", "openai"] as const) {
      if (saved.models[p] === OLD_DEFAULT_MODELS[p]) saved.models[p] = DEFAULT_MODELS[p];
    }
  }
  return {
    provider: saved.provider === "openai" ? "openai" : "anthropic",
    models: { ...base.models, ...(saved.models ?? {}) },
    apiKeys: { ...base.apiKeys, ...(saved.apiKeys ?? {}) },
    autoForge: saved.autoForge ?? base.autoForge,
  };
}

export const saveSettings = (s: Settings) => write("settings", { ...s, version: SETTINGS_VERSION });

export const loadCurrentVideoId = () => read<string>("current");
export function saveCurrentVideoId(id: string | null) {
  if (id) write("current", id);
  else remove("current");
}

/**
 * Bump when the meaning of stored notes changes. Notes are derived from the
 * scribbles, so an older session keeps its scribbles and has its notes
 * rebuilt on the next forge, instead of showing notes made under old rules.
 */
const SESSION_VERSION = 4;

export function loadSession(videoId: string): Session | null {
  const s = read<Session & { version?: number }>(`session:${videoId}`);
  if (!s) return null;
  if ((s.version ?? 1) < SESSION_VERSION) return { ...s, doc: { notes: [], updatedAt: null } };
  return s;
}
export function saveSession(session: Session): boolean {
  const key = `session:${session.video.id}`;
  if (write(key, { ...session, version: SESSION_VERSION })) return true;
  // Storage full: older versions of the document go first, never the scribbles or notes.
  const history = session.history ?? [];
  for (const keep of [5, 0]) {
    if (history.length <= keep && keep > 0) continue;
    if (write(key, { ...session, history: history.slice(history.length - keep), version: SESSION_VERSION })) return true;
  }
  return false;
}
export function deleteSession(videoId: string) {
  remove(`session:${videoId}`);
  remove(`transcript:${videoId}`);
}

/** Saved sessions, most recently opened first. */
export function listSessions(): Session[] {
  return keys()
    .filter((k) => k.startsWith("session:"))
    .map((k) => read<Session>(k))
    .filter((s): s is Session => Boolean(s?.video?.id))
    .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
}

interface CachedTranscript {
  segments: TranscriptSegment[];
  savedAt: number;
}

export function loadTranscript(videoId: string): TranscriptSegment[] | null {
  return read<CachedTranscript>(`transcript:${videoId}`)?.segments ?? null;
}

export function saveTranscript(videoId: string, segments: TranscriptSegment[]): void {
  const cached = keys()
    .filter((k) => k.startsWith("transcript:") && k !== `transcript:${videoId}`)
    .map((k) => ({ k, savedAt: read<CachedTranscript>(k)?.savedAt ?? 0 }))
    .sort((a, b) => b.savedAt - a.savedAt);
  cached.slice(MAX_CACHED_TRANSCRIPTS - 1).forEach(({ k }) => remove(k));
  if (!write(`transcript:${videoId}`, { segments, savedAt: Date.now() })) {
    // Storage full: drop every other cached transcript and try once more.
    cached.forEach(({ k }) => remove(k));
    write(`transcript:${videoId}`, { segments, savedAt: Date.now() });
  }
}
