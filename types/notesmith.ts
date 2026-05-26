/**
 * NoteSmith v1 domain types
 */

/**
 * A single segment from a YouTube transcript.
 * Times are in seconds.
 */
export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

/**
 * A single raw scribble entry.
 * Timestamped to the current playback time when created.
 */
export interface ScribbleEntry {
  id: string;
  text: string;
  timestamp: number; // playback time in seconds
  createdAt: number; // absolute wall-clock ms timestamp
}

/**
 * The current state of the AI-generated Living Document.
 */
export interface LivingDocumentState {
  content: string;
  lastUpdated: number | null; // ms timestamp
}

/**
 * User-configurable workspace settings.
 */
export interface WorkspaceSettings {
  autoUpdateEnabled: boolean;
  answerQuestions: boolean;
}

/**
 * All workspace state persisted to localStorage.
 * This is the full serialized snapshot.
 */
export interface PersistedWorkspaceState {
  videoId: string | null;
  transcriptCache: TranscriptSegment[] | null;
  scribbles: ScribbleEntry[];
  livingDocument: LivingDocumentState;
  panelSizes: number[] | null;
  settings: WorkspaceSettings;
}