/**
 * What a forge costs. The APIs report tokens, not money, so prices live here.
 *
 * Dollars per million tokens, from Anthropic's published prices (checked
 * 2026-11-26). Update this table when prices change or a model is added. A
 * model that isn't listed still has its tokens counted; only its cost is
 * unknown. OpenAI models aren't listed yet.
 *
 * Cache writes are priced for the one-hour cache, the only one NoteSmith uses
 * (2x the input price). Prompts here stay well under 100K tokens, where Haiku
 * 5.5's higher long-prompt price would start.
 */

import type { Spend } from "@/types/notesmith";
import type { Usage } from "./types";

interface Price {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

const PRICES: Record<string, Price> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 8 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 4 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.2 },
};

export function priceOf(model: string): Price | null {
  const id = model.trim().toLowerCase();
  return PRICES[id] ?? Object.entries(PRICES).find(([known]) => id.startsWith(known))?.[1] ?? null;
}

/** Dollars for this usage, or null when the model's price isn't known. */
export function costOf(model: string, usage: Usage): number | null {
  const p = priceOf(model);
  if (!p) return null;
  const cached = usage.cachedTokens ?? 0;
  const written = usage.cacheWriteTokens ?? 0;
  const plain = Math.max(0, usage.inputTokens - cached - written);
  return (plain * p.input + cached * p.cacheRead + written * p.cacheWrite + usage.outputTokens * p.output) / 1e6;
}

export const emptySpend = (): Spend => ({
  costUsd: 0,
  inputTokens: 0,
  outputTokens: 0,
  cachedTokens: 0,
  cacheWriteTokens: 0,
  calls: 0,
  unpricedCalls: 0,
});

/** Add one forge's usage to a running total. */
export function addSpend(spend: Spend | undefined, model: string, usage: Usage & { calls?: number }): Spend {
  const s = spend ?? emptySpend();
  const cost = costOf(model, usage);
  const calls = usage.calls ?? 1;
  return {
    costUsd: s.costUsd + (cost ?? 0),
    inputTokens: s.inputTokens + usage.inputTokens,
    outputTokens: s.outputTokens + usage.outputTokens,
    cachedTokens: s.cachedTokens + (usage.cachedTokens ?? 0),
    cacheWriteTokens: s.cacheWriteTokens + (usage.cacheWriteTokens ?? 0),
    calls: s.calls + calls,
    unpricedCalls: s.unpricedCalls + (cost === null ? calls : 0),
  };
}

/** "0.4¢", "12¢", "$1.23". */
export function formatCost(usd: number): string {
  if (usd <= 0) return "0¢";
  const cents = usd * 100;
  if (cents < 0.1) return "<0.1¢";
  if (cents < 10) return `${cents.toFixed(1)}¢`;
  if (cents < 100) return `${Math.round(cents)}¢`;
  return `$${usd.toFixed(2)}`;
}
