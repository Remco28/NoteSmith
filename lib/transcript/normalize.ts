/**
 * Normalize raw youtube-transcript output to NoteSmith TranscriptSegment[].
 *
 * Raw format: { text: string, duration: number, offset: number, lang: string }[]
 * - offset and duration are in milliseconds
 *
 * Normalized format: { start: number, end: number, text: string }[]
 * - start and end are in seconds
 */

import type { TranscriptSegment } from "@/types/notesmith";

interface RawTranscriptSegment {
  text: string;
  duration: number;
  offset: number;
  lang?: string;
}

export function normalizeTranscript(rawSegments: RawTranscriptSegment[]): TranscriptSegment[] {
  return rawSegments.map((seg) => ({
    start: seg.offset / 1000,
    end: (seg.offset + seg.duration) / 1000,
    text: seg.text,
  }));
}