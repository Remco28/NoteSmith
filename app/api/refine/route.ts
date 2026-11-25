/**
 * POST /api/refine
 *
 * Refines new scribbles into notes. The caller's own API key comes in the
 * `x-api-key` header and is used for this request only; it is never stored
 * or logged. Without one, the server's own key may be used (see
 * lib/server-key.ts for when).
 */

import { NextRequest, NextResponse } from "next/server";
import { LlmError } from "@/lib/llm/types";
import { MAX_PENDING_PER_REQUEST, refine } from "@/lib/refine/run";
import { serverKeyFor } from "@/lib/server-key";
import type { Provider, RefineRequest } from "@/types/notesmith";

export const maxDuration = 120;

const PROVIDERS: Provider[] = ["anthropic", "openai"];

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function str(value: unknown, max: number): string | null {
  return typeof value === "string" ? value.slice(0, max) : null;
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return bad("Invalid JSON body.");
  }

  const provider = body.provider as Provider;
  if (!PROVIDERS.includes(provider)) return bad("Unknown provider.");
  const model = str(body.model, 100)?.trim();
  if (!model) return bad("Choose a model in Settings.");

  const pendingRaw = Array.isArray(body.pending) ? body.pending : [];
  const notesRaw = Array.isArray(body.notes) ? body.notes : [];
  if (pendingRaw.length === 0) return bad("Nothing to refine.");
  if (pendingRaw.length > MAX_PENDING_PER_REQUEST) return bad("Too many scribbles in one request.");
  if (notesRaw.length > 500) return bad("Too many notes.");

  const video = (body.video ?? {}) as Record<string, unknown>;
  const req: RefineRequest = {
    provider,
    model,
    video: { title: str(video.title, 300), author: str(video.author, 200) },
    notes: notesRaw.map((n: Record<string, unknown>) => ({
      id: str(n.id, 64) ?? "",
      topic: str(n.topic, 80) ?? "",
      text: str(n.text, 2000) ?? "",
      times: Array.isArray(n.times) ? n.times.filter((t): t is number => typeof t === "number").slice(0, 20) : [],
    })),
    pending: pendingRaw.map((p: Record<string, unknown>) => ({
      id: str(p.id, 64) ?? "",
      time: typeof p.time === "number" ? p.time : 0,
      text: str(p.text, 4000) ?? "",
      context: str(p.context, 2000) ?? "",
    })),
  };

  const userKey = request.headers.get("x-api-key")?.trim();
  const apiKey = userKey || serverKeyFor(request, provider);
  if (!apiKey) {
    const name = provider === "anthropic" ? "Anthropic" : "OpenAI";
    return bad(`Add your ${name} API key in Settings to start forging.`, 401);
  }

  try {
    const result = await refine(req, apiKey);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof LlmError) return bad(error.message, error.status);
    console.error("[refine]", error instanceof Error ? error.message : "unknown error");
    return bad("Something went wrong while forging.", 500);
  }
}
