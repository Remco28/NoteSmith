/**
 * Simple checksum utilities for localStorage cache invalidation.
 * Uses a fast string hash — not cryptographic.
 */

/**
 * Compute a deterministic hash of an array of scribble entries.
 * The checksum changes when scribble content or ordering changes.
 */
export function scribblesChecksum(scribbles: { text: string; timestamp: number }[]): string {
  const input = scribbles.map((s) => `${s.timestamp}::${s.text}`).join("|");
  return simpleHash(input);
}

/**
 * Fast string hash for cache keys.
 * Not cryptographic — just distributes strings across 32-bit space.
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // 32-bit integer overflow
  }
  // Produce a non-negative hex string
  return Math.abs(hash).toString(16).padStart(8, "0");
}
