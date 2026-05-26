/**
 * YouTube transcript adapter using the youtube-transcript npm package.
 *
 * Wraps the raw youtube-transcript fetch with:
 * - Error mapping to TranscriptUnavailableError
 * - Output normalization to NoteSmith TranscriptSegment[]
 */

import {
  YoutubeTranscriptError,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptVideoUnavailableError,
  fetchTranscript as rawFetchTranscript,
} from "youtube-transcript";

import { TranscriptUnavailableError } from "@/lib/errors";
import { normalizeTranscript } from "@/lib/transcript/normalize";
import type { TranscriptSegment } from "@/types/notesmith";

/**
 * Fetch and normalize transcript segments for a YouTube video.
 *
 * @param videoId - A valid YouTube video ID (11 characters)
 * @returns Normalized transcript segments sorted by start time
 * @throws TranscriptUnavailableError when captions are not available or disabled
 */
export async function fetchTranscript(videoId: string): Promise<TranscriptSegment[]> {
  try {
    const raw = await rawFetchTranscript(videoId);
    return normalizeTranscript(raw);
  } catch (err) {
    if (err instanceof YoutubeTranscriptDisabledError) {
      throw new TranscriptUnavailableError(
        videoId,
        "Captions are disabled on this video."
      );
    }
    if (err instanceof YoutubeTranscriptNotAvailableError) {
      throw new TranscriptUnavailableError(
        videoId,
        "No captions are available for this video."
      );
    }
    if (err instanceof YoutubeTranscriptVideoUnavailableError) {
      throw new TranscriptUnavailableError(
        videoId,
        "Video is unavailable."
      );
    }
    if (err instanceof YoutubeTranscriptError) {
      // Covers rate limiting, API changes, and other undocumented failures
      throw new TranscriptUnavailableError(
        videoId,
        `YouTube transcript service error: ${err.message}`
      );
    }
    // Re-throw non-YouTube errors as-is
    throw err;
  }
}