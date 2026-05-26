/**
 * YouTube utility helpers
 */

/**
 * Extract a YouTube video ID from various URL formats.
 *
 * Supports:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://www.youtube.com/watch?v=VIDEO_ID&list=...
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/v/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 *
 * Returns null if the input does not match a recognized pattern.
 */
export function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Handle youtu.be short links
  const shortLinkMatch = trimmed.match(
    /^https?:\/\/youtu\.be\/([a-zA-Z0-9_-]{11})/
  );
  if (shortLinkMatch) return shortLinkMatch[1];

  // Handle youtube.com URLs
  const urlMatch = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/
  );
  if (urlMatch) return urlMatch[1];

  // If it looks like a bare video ID (11 chars), return it directly
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}