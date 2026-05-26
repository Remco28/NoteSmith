/**
 * localStorage persistence layer for NoteSmith workspace state.
 *
 * Browser-only: all functions are safe no-ops in server/SSR contexts.
 * Uses 1-second debounce for write-heavy updates.
 * Living Document cache is keyed by videoId + scribbles checksum.
 */

import type {
  PersistedWorkspaceState,
  TranscriptSegment,
  ScribbleEntry,
  LivingDocumentState,
  WorkspaceSettings,
} from "@/types/notesmith";
import { scribblesChecksum } from "@/lib/utils/checksum";

const STORAGE_KEY = "notesmith:workspace";

/** Default empty state — used when nothing is persisted yet. */
function defaultState(): PersistedWorkspaceState {
  return {
    videoId: null,
    transcriptCache: null,
    scribbles: [],
    livingDocument: { content: "", lastUpdated: null },
    panelSizes: null,
    settings: { autoUpdateEnabled: true, answerQuestions: true },
  };
}

/** ---------------------------------------------------------------------------
 * Guard: only run in browser
 * ------------------------------------------------------------------------- */

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/** ---------------------------------------------------------------------------
 * Raw load / save (no debounce)
 * ------------------------------------------------------------------------- */

function loadRaw(): PersistedWorkspaceState {
  if (!isBrowser()) return defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) } as PersistedWorkspaceState;
  } catch {
    return defaultState();
  }
}

function saveRaw(state: PersistedWorkspaceState): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota exceeded or private browsing — fail silently
  }
}

/** ---------------------------------------------------------------------------
 * Debounced save
 * ------------------------------------------------------------------------- */

type SaveFn = () => void;

const debounceMap = new Map<string, { timer: ReturnType<typeof setTimeout>; fn: SaveFn }>();

/**
 * Debounce a save operation by 1 second.
 * Subsequent calls to the same key reset the timer.
 */
function debouncedSave(key: string, fn: SaveFn, delayMs = 1000): void {
  const existing = debounceMap.get(key);
  if (existing) clearTimeout(existing.timer);
  const timer = setTimeout(() => {
    debounceMap.delete(key);
    fn();
  }, delayMs);
  debounceMap.set(key, { timer, fn });
}

/** ---------------------------------------------------------------------------
 * Public API — single-state helpers
 * ------------------------------------------------------------------------- */

/**
 * Load persisted workspace state from localStorage.
 * Returns default state if nothing is stored or in non-browser environments.
 */
export function loadWorkspaceState(): PersistedWorkspaceState {
  return loadRaw();
}

/**
 * Persist the full workspace state.
 * DEBOUNCED: heavy panel size updates are written after 1s of inactivity.
 */
export function saveWorkspaceState(state: PersistedWorkspaceState): void {
  debouncedSave("workspace:full", () => saveRaw(state));
}

/** ---------------------------------------------------------------------------
 * Public API — granular helpers (all debounced except videoId which is cheap)
 * ------------------------------------------------------------------------- */

/** Current video ID — not debounced (write is cheap, read must be instant) */
export function saveVideoId(videoId: string | null): void {
  const state = loadRaw();
  state.videoId = videoId;
  saveRaw(state);
}

/** Transcript cache for the current video — debounced */
export function saveTranscriptCache(cache: TranscriptSegment[] | null): void {
  debouncedSave("transcript", () => {
    const state = loadRaw();
    state.transcriptCache = cache;
    saveRaw(state);
  });
}

/** Scribbles — debounced */
export function saveScribbles(scribbles: ScribbleEntry[]): void {
  debouncedSave("scribbles", () => {
    const state = loadRaw();
    state.scribbles = scribbles;
    saveRaw(state);
  });
}

/** Panel sizes — debounced (write-heavy during resize) */
export function savePanelSizes(sizes: number[]): void {
  debouncedSave("panels", () => {
    const state = loadRaw();
    state.panelSizes = sizes;
    saveRaw(state);
  });
}

/** Settings — debounced (toggle flips are rare but we don't want to miss any) */
export function saveSettings(settings: WorkspaceSettings): void {
  debouncedSave("settings", () => {
    const state = loadRaw();
    state.settings = settings;
    saveRaw(state);
  });
}

/**
 * Persist autoUpdateEnabled setting immediately (not debounced).
 * Toggle feedback needs to be instant.
 */
export function saveAutoUpdateEnabled(enabled: boolean): void {
  if (!isBrowser()) return;
  const state = loadRaw();
  state.settings = { ...state.settings, autoUpdateEnabled: enabled };
  saveRaw(state);
}

/** ---------------------------------------------------------------------------
 * Living Document cache
 * Keyed by videoId + scribbles checksum so it survives scribble edits
 * but invalidates when the underlying material changes.
 * ------------------------------------------------------------------------- */

const LD_STORAGE_KEY = "notesmith:living-doc";

interface LivingDocCacheEntry {
  content: string;
  lastUpdated: number;
}

/**
 * Build the storage key for the living document cache.
 */
export function livingDocCacheKey(videoId: string | null, scribbles: ScribbleEntry[]): string {
  if (!videoId) return "ld:none";
  const cs = scribblesChecksum(scribbles);
  return `ld:${videoId}:${cs}`;
}

function loadLDEntry(key: string): LivingDocumentState | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(LD_STORAGE_KEY);
    if (!raw) return null;
    const entries: Record<string, LivingDocCacheEntry> = JSON.parse(raw);
    const entry = entries[key];
    if (!entry) return null;
    return { content: entry.content, lastUpdated: entry.lastUpdated };
  } catch {
    return null;
  }
}

function saveLDEntry(key: string, doc: LivingDocumentState): void {
  if (!isBrowser()) return;
  try {
    const raw = localStorage.getItem(LD_STORAGE_KEY);
    const entries: Record<string, LivingDocCacheEntry> = raw ? JSON.parse(raw) : {};
    entries[key] = { content: doc.content, lastUpdated: doc.lastUpdated ?? Date.now() };
    localStorage.setItem(LD_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // quota exceeded — skip
  }
}

/**
 * Load a cached Living Document for the given video+scribbles combination.
 * Returns null if no matching cache entry exists.
 */
export function loadLivingDocument(
  videoId: string | null,
  scribbles: ScribbleEntry[],
): LivingDocumentState | null {
  const key = livingDocCacheKey(videoId, scribbles);
  return loadLDEntry(key);
}

/**
 * Persist a Living Document against its video+scribbles cache key.
 * This is a separate namespace from the main workspace state.
 */
export function saveLivingDocument(
  videoId: string | null,
  scribbles: ScribbleEntry[],
  doc: LivingDocumentState,
): void {
  const key = livingDocCacheKey(videoId, scribbles);
  saveLDEntry(key, doc);
}
