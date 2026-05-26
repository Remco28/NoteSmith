/**
 * GET /api/transcript?videoId=XXX
 *
 * Server-side transcript retrieval endpoint.
 * Returns normalized transcript segments for a YouTube video.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchTranscript } from "@/lib/transcript/adapter";
import { TranscriptUnavailableError } from "@/lib/errors";
import { extractVideoId } from "@/lib/utils/youtube";

export async function GET(request: NextRequest) {
  const videoId = extractVideoId(request.nextUrl.searchParams.get("videoId") || "");

  if (!videoId) {
    return NextResponse.json(
      { error: "Missing or invalid videoId parameter" },
      { status: 400 }
    );
  }

  try {
    const segments = await fetchTranscript(videoId);
    return NextResponse.json({ segments });
  } catch (err) {
    if (err instanceof TranscriptUnavailableError) {
      return NextResponse.json(
        { error: err.message },
        { status: 422 }
      );
    }
    // Unexpected error — surface as 500 so the client knows something broke
    console.error("[transcript route]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}