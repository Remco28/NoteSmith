export interface JsonRequest {
  model: string;
  apiKey: string;
  system: string;
  /** Large, rarely changing text sent before `user` and cached where the provider allows. */
  context?: string;
  user: string;
  schema: Record<string, unknown>;
  maxTokens: number;
}

export interface JsonResult {
  json: unknown;
  usage: Usage;
}

/** Tokens one or more model calls used. */
export interface Usage {
  /** Every input token: plain, read from the cache, and written to it. */
  inputTokens: number;
  outputTokens: number;
  /** Input tokens read from the cache (billed at a small fraction). */
  cachedTokens?: number;
  /** Input tokens written to the cache (billed at a premium; one-hour cache here). */
  cacheWriteTokens?: number;
}

/** A failure with a message that is safe and useful to show the user. */
export class LlmError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "LlmError";
  }
}
