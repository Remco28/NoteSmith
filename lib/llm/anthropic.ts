import Anthropic from "@anthropic-ai/sdk";
import { LlmError, type JsonRequest, type JsonResult } from "./types";

/**
 * Models that accept `output_config.effort`. Older models reject it with a
 * 400, so it is only sent where it is known to work.
 */
function supportsEffort(model: string): boolean {
  return /^claude-(haiku-5|sonnet-5|opus-5|opus-4-[678]|sonnet-4-6|fable|mythos)/.test(model);
}

/** Refining is a light rewrite; low effort keeps it fast. Override for experiments. */
const EFFORT = (process.env.NOTESMITH_EFFORT as "low" | "medium" | "high" | undefined) ?? "low";

export async function anthropicJson(req: JsonRequest): Promise<JsonResult> {
  const client = new Anthropic({
    apiKey: req.apiKey,
    maxRetries: 2,
    timeout: 90_000,
    // NoteSmith has no server: the user's own key goes from their browser
    // straight to Anthropic, which is what this flag allows.
    dangerouslyAllowBrowser: true,
  });

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: req.model,
      max_tokens: req.maxTokens,
      system: req.system,
      messages: [
        {
          role: "user",
          content: [
            ...(req.context
              ? [
                  {
                    type: "text" as const,
                    text: req.context,
                    // An hour, not the default 5 minutes: people often go longer than
                    // 5 minutes between scribbles, and rewriting a long transcript
                    // into the cache costs ~25x a cache read.
                    cache_control: { type: "ephemeral" as const, ttl: "1h" as const },
                  },
                ]
              : []),
            { type: "text" as const, text: req.user },
          ],
        },
      ],
      output_config: {
        format: { type: "json_schema", schema: req.schema },
        ...(supportsEffort(req.model) ? { effort: EFFORT } : {}),
      },
    });
  } catch (error) {
    throw toLlmError(error, req.model);
  }

  if (response.stop_reason === "refusal") {
    throw new LlmError("The model declined to refine these scribbles.", 422);
  }
  if (response.stop_reason === "max_tokens") {
    throw new LlmError("The model's answer was cut off. Try forging fewer scribbles at once.", 502);
  }

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new LlmError("The model returned something that wasn't valid JSON.", 502);
  }

  return {
    json,
    usage: {
      inputTokens:
        response.usage.input_tokens +
        (response.usage.cache_read_input_tokens ?? 0) +
        (response.usage.cache_creation_input_tokens ?? 0),
      outputTokens: response.usage.output_tokens,
      cachedTokens: response.usage.cache_read_input_tokens ?? 0,
    },
  };
}

function toLlmError(error: unknown, model: string): LlmError {
  if (error instanceof Anthropic.AuthenticationError) {
    return new LlmError("Anthropic rejected the API key. Check it in Settings.", 401);
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return new LlmError("This Anthropic API key isn't allowed to use that model.", 403);
  }
  if (error instanceof Anthropic.NotFoundError) {
    return new LlmError(`Anthropic doesn't recognize the model "${model}". Check it in Settings.`, 404);
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new LlmError("Anthropic's rate limit was hit. Wait a moment and forge again.", 429);
  }
  if (error instanceof Anthropic.BadRequestError) {
    return new LlmError(`Anthropic refused the request: ${error.message}`, 400);
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new LlmError("Couldn't reach Anthropic. Check your connection.", 503);
  }
  if (error instanceof Anthropic.APIError) {
    return new LlmError(`Anthropic error (${error.status ?? "unknown"}). Try again.`, 502);
  }
  return new LlmError("Something went wrong while forging.", 500);
}
