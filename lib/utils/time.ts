/**
 * Time formatting helpers
 */

/**
 * Format a number of seconds into a human-readable timestamp.
 *
 * Examples:
 *   formatSeconds(0)       → "0:00"
 *   formatSeconds(5)      → "0:05"
 *   formatSeconds(65)     → "1:05"
 *   formatSeconds(3725)   → "1:02:05"
 */
export function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return `${minutes}:${String(secs).padStart(2, "0")}`;
}