/**
 * Browser persistence. Everything lives in localStorage:
 *   notesmith:settings          provider, models, API keys, preferences
 *   notesmith:current           id of the open video
 *   notesmith:session:<videoId> scribbles + Living Document for one video
 *   notesmith:transcript:<id>   cached captions (only the most recent few)
 *
 * Every access is wrapped: private windows and full storage must never
 * break the app, they only mean nothing is remembered.
 */

import type { Session, Settings, TranscriptSegment } from "@/types/notesmith";

const PREFIX = "notesmith:";
const MAX_CACHED_TRANSCRIPTS = 6;

export const DEFAULT_MODELS = { anthropic: "claude-haiku-5-5", openai: "gpt-5.4-nano" } as const;

export function defaultSettings(): Settings {
  return {
    provider: "anthropic",
    models: { ...DEFAULT_MODELS },
    apiKeys: { anthropic: "", openai: "" },
    autoForge: true,
    showContext: false,
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

export function loadSettings(): Settings {
  const saved = read<Partial<Settings>>("settings");
  const base = defaultSettings();
  if (!saved) return base;
  return {
    provider: saved.provider === "openai" ? "openai" : "anthropic",
    models: { ...base.models, ...(saved.models ?? {}) },
    apiKeys: { ...base.apiKeys, ...(saved.apiKeys ?? {}) },
    autoForge: saved.autoForge ?? base.autoForge,
    showContext: saved.showContext ?? base.showContext,
  };
}

export const saveSettings = (s: Settings) => write("settings", s);

export const loadCurrentVideoId = () => read<string>("current");
export function saveCurrentVideoId(id: string | null) {
  if (id) write("current", id);
  else remove("current");
}

export const loadSession = (videoId: string) => read<Session>(`session:${videoId}`);
export const saveSession = (session: Session) => write(`session:${session.video.id}`, session);
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
