import OpenAI from "openai";
import { LlmError, type JsonRequest, type JsonResult } from "./types";

export async function openaiJson(req: JsonRequest): Promise<JsonResult> {
  // No server: the key goes from the browser straight to OpenAI.
  const client = new OpenAI({ apiKey: req.apiKey, maxRetries: 2, timeout: 90_000, dangerouslyAllowBrowser: true });

  let completion: OpenAI.Chat.Completions.ChatCompletion;
  try {
    completion = await client.chat.completions.create({
      model: req.model,
      max_completion_tokens: req.maxTokens,
      messages: [
        { role: "system", content: req.system },
        // The transcript goes first so OpenAI's automatic prefix cache can reuse it.
        { role: "user", content: req.context ? `${req.context}\n\n${req.user}` : req.user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "refined_notes", strict: true, schema: req.schema },
      },
    });
  } catch (error) {
    throw toLlmError(error, req.model);
  }

  const choice = completion.choices[0];
  if (choice?.message?.refusal) {
    throw new LlmError("The model declined to refine these scribbles.", 422);
  }
  if (choice?.finish_reason === "length") {
    throw new LlmError("The model's answer was cut off. Try forging fewer scribbles at once.", 502);
  }

  let json: unknown;
  try {
    json = JSON.parse(choice?.message?.content ?? "");
  } catch {
    throw new LlmError("The model returned something that wasn't valid JSON.", 502);
  }

  return {
    json,
    usage: {
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
    },
  };
}

function toLlmError(error: unknown, model: string): LlmError {
  if (error instanceof OpenAI.AuthenticationError) {
    return new LlmError("OpenAI rejected the API key. Check it in Settings.", 401);
  }
  if (error instanceof OpenAI.PermissionDeniedError) {
    return new LlmError("This OpenAI API key isn't allowed to use that model.", 403);
  }
  if (error instanceof OpenAI.NotFoundError) {
    return new LlmError(`OpenAI doesn't recognize the model "${model}". Check it in Settings.`, 404);
  }
  if (error instanceof OpenAI.RateLimitError) {
    return new LlmError("OpenAI's rate limit was hit. Wait a moment and forge again.", 429);
  }
  if (error instanceof OpenAI.BadRequestError) {
    return new LlmError(`OpenAI refused the request: ${error.message}`, 400);
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return new LlmError("Couldn't reach OpenAI. Check your connection.", 503);
  }
  if (error instanceof OpenAI.APIError) {
    return new LlmError(`OpenAI error (${error.status ?? "unknown"}). Try again.`, 502);
  }
  return new LlmError("Something went wrong while forging.", 500);
}
