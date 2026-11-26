/**
 * Server-side refine step: one model call (plus one retry for anything the
 * model left out), with the answer checked against the request.
 */

import { z } from "zod";
import { anthropicJson } from "@/lib/llm/anthropic";
import { openaiJson } from "@/lib/llm/openai";
import { LlmError, type JsonRequest, type JsonResult } from "@/lib/llm/types";
import { parseTime } from "@/lib/doc";
import { OUTPUT_SCHEMA, SYSTEM_PROMPT, buildTranscriptBlock, buildUserPrompt } from "@/lib/refine/prompt";
import type { Provider, RefineItem, RefineRequest, RefineResponse, TopicMove } from "@/types/notesmith";

/** Most scribbles a single request may carry. The browser sends larger sets in batches. */
export const MAX_PENDING_PER_REQUEST = 30;

const ItemSchema = z.object({
  sourceIds: z.array(z.string()),
  mergeInto: z.string().nullable(),
  topic: z.string(),
  text: z.string(),
  detailKind: z.enum(["none", "video", "answer", "general"]).catch("none"),
  detail: z.string().default(""),
  detailAt: z.string().default(""),
});
const AnswerSchema = z.object({
  items: z.array(ItemSchema),
  moves: z.array(z.object({ noteId: z.string(), topic: z.string() })).default([]),
});

const callers: Record<Provider, (req: JsonRequest) => Promise<JsonResult>> = {
  anthropic: anthropicJson,
  openai: openaiJson,
};

async function callOnce(req: RefineRequest, apiKey: string) {
  const result = await callers[req.provider]({
    model: req.model,
    apiKey,
    system: SYSTEM_PROMPT,
    context: buildTranscriptBlock(req.video, req.transcript),
    user: buildUserPrompt(req.notes, req.pending),
    schema: OUTPUT_SCHEMA as unknown as Record<string, unknown>,
    // A note plus its detail is under 150 tokens; this fits 30 with room to spare.
    maxTokens: 12000,
  });
  const parsed = AnswerSchema.safeParse(result.json);
  if (!parsed.success) {
    throw new LlmError("The model's answer wasn't in the expected shape.", 502);
  }
  const items: RefineItem[] = parsed.data.items.map((it) => ({
    sourceIds: it.sourceIds,
    mergeInto: it.mergeInto,
    topic: it.topic,
    text: it.text,
    detail:
      it.detailKind !== "none" && it.detail.trim()
        ? { kind: it.detailKind, text: it.detail.trim(), at: parseTime(it.detailAt) }
        : null,
  }));
  return { items, moves: parsed.data.moves as TopicMove[], usage: result.usage };
}

function coveredIds(items: RefineItem[], allowed: Set<string>): Set<string> {
  const covered = new Set<string>();
  for (const item of items) for (const id of item.sourceIds) if (allowed.has(id)) covered.add(id);
  return covered;
}

export async function refine(req: RefineRequest, apiKey: string): Promise<RefineResponse> {
  const pendingIds = new Set(req.pending.map((p) => p.id));
  const usage = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };

  const first = await callOnce(req, apiKey);
  usage.inputTokens += first.usage.inputTokens;
  usage.outputTokens += first.usage.outputTokens;
  usage.cachedTokens += first.usage.cachedTokens ?? 0;
  const items = [...first.items];

  let covered = coveredIds(items, pendingIds);
  const missingFirst = req.pending.filter((p) => !covered.has(p.id));

  if (missingFirst.length > 0) {
    try {
      const retry = await callOnce({ ...req, pending: missingFirst }, apiKey);
      usage.inputTokens += retry.usage.inputTokens;
      usage.outputTokens += retry.usage.outputTokens;
      usage.cachedTokens += retry.usage.cachedTokens ?? 0;
      items.push(...retry.items);
      covered = coveredIds(items, pendingIds);
    } catch {
      // The browser keeps anything still missing as a raw note.
    }
  }

  const noteIds = new Set(req.notes.map((n) => n.id));
  return {
    items,
    moves: first.moves.filter((m) => noteIds.has(m.noteId) && m.topic.trim()),
    missing: req.pending.filter((p) => !covered.has(p.id)).map((p) => p.id),
    usage,
  };
}
