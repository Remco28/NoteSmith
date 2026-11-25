/**
 * GET /api/config
 *
 * Tells the browser whether this server will refine with its own key, so the
 * app asks for a key only when one is needed. Never returns a key.
 */

import { NextRequest, NextResponse } from "next/server";
import { serverKeyFor } from "@/lib/server-key";

export function GET(request: NextRequest) {
  return NextResponse.json(
    {
      serverKey: {
        anthropic: Boolean(serverKeyFor(request, "anthropic")),
        openai: Boolean(serverKeyFor(request, "openai")),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
