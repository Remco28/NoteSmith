/**
 * Server-side refine step: one model call (plus one retry for anything the
 * model left out), with the answer checked against the request.
 */

import { z } from "zod";
import { anthropicJson } from "@/lib/llm/anthropic";
import { openaiJson } from "@/lib/llm/openai";
import { LlmError, type JsonRequest, type JsonResult } from "@/lib/llm/types";
import { OUTPUT_SCHEMA, SYSTEM_PROMPT, buildUserPrompt } from "@/lib/refine/prompt";
import type { Provider, RefineItem, RefineRequest, RefineResponse, TopicMove } from "@/types/notesmith";

/** Most scribbles a single request may carry. The browser sends larger sets in batches. */
export const MAX_PENDING_PER_REQUEST = 30;

const ItemSchema = z.object({
  sourceIds: z.array(z.string()),
  mergeInto: z.string().nullable(),
  topic: z.string(),
  text: z.string(),
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
    user: buildUserPrompt(req.video, req.notes, req.pending),
    schema: OUTPUT_SCHEMA as unknown as Record<string, unknown>,
    // Notes are short; this leaves plenty of room for 30 scribbles.
    maxTokens: 8000,
  });
  const parsed = AnswerSchema.safeParse(result.json);
  if (!parsed.success) {
    throw new LlmError("The model's answer wasn't in the expected shape.", 502);
  }
  return { items: parsed.data.items as RefineItem[], moves: parsed.data.moves as TopicMove[], usage: result.usage };
}

function coveredIds(items: RefineItem[], allowed: Set<string>): Set<string> {
  const covered = new Set<string>();
  for (const item of items) for (const id of item.sourceIds) if (allowed.has(id)) covered.add(id);
  return covered;
}

export async function refine(req: RefineRequest, apiKey: string): Promise<RefineResponse> {
  const pendingIds = new Set(req.pending.map((p) => p.id));
  const usage = { inputTokens: 0, outputTokens: 0 };

  const first = await callOnce(req, apiKey);
  usage.inputTokens += first.usage.inputTokens;
  usage.outputTokens += first.usage.outputTokens;
  const items = [...first.items];

  let covered = coveredIds(items, pendingIds);
  const missingFirst = req.pending.filter((p) => !covered.has(p.id));

  if (missingFirst.length > 0) {
    try {
      const retry = await callOnce({ ...req, pending: missingFirst }, apiKey);
      usage.inputTokens += retry.usage.inputTokens;
      usage.outputTokens += retry.usage.outputTokens;
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
