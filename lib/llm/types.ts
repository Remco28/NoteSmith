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
  /** inputTokens counts every input token, cached or not. */
  usage: { inputTokens: number; outputTokens: number; cachedTokens?: number };
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
