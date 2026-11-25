/**
 * GET /api/transcript?videoId=XXX&lang=en
 *
 * Returns the video's captions (as segments in seconds) and its title.
 * 422 means the video has no usable captions.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchTranscript, fetchVideoInfo } from "@/lib/transcript/adapter";
import { TranscriptUnavailableError } from "@/lib/errors";
import { extractVideoId } from "@/lib/utils/youtube";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const videoId = extractVideoId(params.get("videoId") || "");
  if (!videoId) {
    return NextResponse.json({ error: "That doesn't look like a YouTube link." }, { status: 400 });
  }
  const lang = (params.get("lang") || "").match(/^[a-z]{2,3}/i)?.[0]?.toLowerCase();

  const infoPromise = fetchVideoInfo(videoId);
  try {
    const { segments, lang: found } = await fetchTranscript(videoId, lang);
    const info = await infoPromise;
    return NextResponse.json({ segments, lang: found, ...info });
  } catch (err) {
    const info = await infoPromise;
    if (err instanceof TranscriptUnavailableError) {
      return NextResponse.json({ error: err.message, ...info }, { status: 422 });
    }
    console.error("[transcript]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Couldn't load the transcript. Try again." }, { status: 500 });
  }
}
