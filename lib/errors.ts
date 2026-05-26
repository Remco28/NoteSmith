/**
 * Shared domain errors
 */

/**
 * Thrown when a YouTube video has no captions available,
 * or when caption retrieval fails in a way that cannot be recovered.
 */
export class TranscriptUnavailableError extends Error {
  constructor(videoId: string, reason?: string) {
    const message = reason
      ? `Transcript unavailable for video ${videoId}: ${reason}`
      : `Transcript unavailable for video ${videoId}. NoteSmith supports captioned YouTube videos only.`;
    super(message);
    this.name = "TranscriptUnavailableError";
  }
}