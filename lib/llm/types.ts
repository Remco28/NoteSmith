export interface JsonRequest {
  model: string;
  apiKey: string;
  system: string;
  user: string;
  schema: Record<string, unknown>;
  maxTokens: number;
}

export interface JsonResult {
  json: unknown;
  usage: { inputTokens: number; outputTokens: number };
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
