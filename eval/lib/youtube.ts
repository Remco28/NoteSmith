/**
 * YouTube transcript lookup for the eval (Node only). The app itself gets
 * transcripts from the NoteSmith bookmark; see lib/bookmarklet.ts.
 *
 * Captions come from the `youtube-transcript` package, which reads YouTube's
 * public (undocumented) caption endpoint. Without a language it returns the
 * first caption track, which may be a translation, so we ask for the
 * preferred language first, then English, then whatever exists.
 */

import {
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptNotAvailableLanguageError,
  YoutubeTranscriptVideoUnavailableError,
  fetchTranscript as rawFetchTranscript,
} from "youtube-transcript";

import { TranscriptUnavailableError } from "./errors";
import { normalizeTranscript } from "./normalize";
import type { TranscriptSegment } from "@/types/notesmith";

export async function fetchTranscript(
  videoId: string,
  preferredLang?: string,
): Promise<{ segments: TranscriptSegment[]; lang: string | null }> {
  const langs = [...new Set([preferredLang, "en", undefined])];

  for (const lang of langs) {
    try {
      const raw = await rawFetchTranscript(videoId, lang ? { lang } : undefined);
      const segments = normalizeTranscript(raw);
      if (segments.length === 0) continue;
      return { segments, lang: raw[0]?.lang ?? lang ?? null };
    } catch (err) {
      if (err instanceof YoutubeTranscriptNotAvailableLanguageError) continue;
      throw mapError(videoId, err);
    }
  }
  throw new TranscriptUnavailableError(videoId, "No captions are available for this video.");
}

function mapError(videoId: string, err: unknown): unknown {
  if (err instanceof YoutubeTranscriptDisabledError) {
    return new TranscriptUnavailableError(videoId, "Captions are turned off for this video.");
  }
  if (err instanceof YoutubeTranscriptNotAvailableError) {
    return new TranscriptUnavailableError(videoId, "No captions are available for this video.");
  }
  if (err instanceof YoutubeTranscriptVideoUnavailableError) {
    return new TranscriptUnavailableError(videoId, "This video is unavailable.");
  }
  if (err instanceof YoutubeTranscriptError) {
    return new TranscriptUnavailableError(videoId, "YouTube wouldn't hand over the captions right now.");
  }
  return err;
}
