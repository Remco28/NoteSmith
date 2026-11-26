/**
 * Thrown when a YouTube video has no usable captions. The message is shown
 * to the user as-is.
 */
export class TranscriptUnavailableError extends Error {
  constructor(
    public readonly videoId: string,
    reason = "No captions are available for this video.",
  ) {
    super(reason);
    this.name = "TranscriptUnavailableError";
  }
}
