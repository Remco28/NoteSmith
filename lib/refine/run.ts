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
  context: z.string().nullable().default(null),
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

/** Lowercase letters and digits only, single-spaced: for comparing quotes. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Keep a context quote only if it appears word for word in what was said
 * just before one of its scribbles. A paraphrase or a guess about another
 * moment is dropped, so an aside is always something that was really said.
 */
const REACTION_WORDS = new Set(
  "lol lmao lmfao rofl haha hah ha heh hehe this that these those it wait what huh hm hmm same wow whoa omg wtf ok okay oh yes yeah no nope really seriously ugh yikes damn nice right so true agreed".split(" "),
);

/** A scribble that is only a reaction or pointing word, like "lol that" or "wait what". */
export function isReaction(text: string): boolean {
  const words = normalize(text).split(" ").filter(Boolean);
  return words.length > 0 && words.length <= 4 && words.every((w) => REACTION_WORDS.has(w));
}

export function verifyContext(items: RefineItem[], pending: RefineRequest["pending"]): RefineItem[] {
  const byId = new Map(pending.map((p) => [p.id, p]));
  return items.map((item) => {
    const quote = normalize((item.context ?? "").replace(/^\s*(re:)\s*/i, ""));
    if (!quote) return { ...item, context: null };
    // Only reaction scribbles get an aside, and only a quote of whole words
    // that were said in the seconds before.
    const ok = item.sourceIds.some((id) => {
      const p = byId.get(id);
      return p && isReaction(p.text) && ` ${normalize(p.recent)} `.includes(` ${quote} `);
    });
    return ok ? item : { ...item, context: null };
  });
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
    items: verifyContext(items, req.pending),
    moves: first.moves.filter((m) => noteIds.has(m.noteId) && m.topic.trim()),
    missing: req.pending.filter((p) => !covered.has(p.id)).map((p) => p.id),
    usage,
  };
}
