/**
 * Title and channel of a YouTube video, from YouTube's public oEmbed
 * endpoint, which browsers may call from any site. Never throws.
 */
export async function fetchVideoInfo(
  videoId: string,
): Promise<{ title: string | null; author: string | null }> {
  try {
    const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${videoId}`,
    )}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { title: null, author: null };
    const data = (await res.json()) as { title?: string; author_name?: string };
    return { title: data.title ?? null, author: data.author_name ?? null };
  } catch {
    return { title: null, author: null };
  }
}
