/**
 * Token counts for each video, as the AI provider reports them. NoteSmith
 * shows tokens, not money: prices change, and keeping a price table up to
 * date isn't worth it. The provider's console has the real bill.
 */

import type { Usage } from "@/lib/llm/types";
import type { TokenUse } from "@/types/notesmith";

export const emptyTokenUse = (): TokenUse => ({
  inputTokens: 0,
  outputTokens: 0,
  cachedTokens: 0,
  cacheWriteTokens: 0,
  calls: 0,
});

/** Add one forge's usage to a running total. */
export function addTokens(total: TokenUse | undefined, usage: Usage & { calls?: number }): TokenUse {
  const t = total ?? emptyTokenUse();
  return {
    inputTokens: t.inputTokens + usage.inputTokens,
    outputTokens: t.outputTokens + usage.outputTokens,
    cachedTokens: t.cachedTokens + (usage.cachedTokens ?? 0),
    cacheWriteTokens: t.cacheWriteTokens + (usage.cacheWriteTokens ?? 0),
    calls: t.calls + (usage.calls ?? 1),
  };
}

/** Everything sent and received. */
export const totalTokens = (t: TokenUse) => t.inputTokens + t.outputTokens;

/** "850", "21.6k", "1.2M". */
export function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 100_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}
