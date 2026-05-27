/**
 * OpenAI client wrapper for NoteSmith.
 * Default model: gpt-5.4-nano. Override with OPENAI_MODEL env var.
 */

import OpenAI from "openai";

export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-5.4-nano";

export function createOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({ apiKey });
}

export function buildLivingDocumentPrompt(
  transcriptSegments: Array<{ start: number; end: number; text: string }>,
  scribbles: Array<{ id: string; text: string; timestamp: number }>,
): string {
  const transcriptText = transcriptSegments
    .map((s) => `[${formatSeconds(s.start)}] ${s.text}`)
    .join("\n");

  const scribblesText = scribbles
    .map((s) => `[${formatSeconds(s.timestamp)}] ${s.text}`)
    .join("\n");

  return `You are NoteSmith, an AI note refiner.

You are given a YouTube transcript and the user's raw scribbles.
Your job is to turn the scribbles into a short, useful markdown note.

## Transcript
${transcriptText}

## Scribbled Notes
${scribblesText}

## What NoteSmith should do
- The scribbles are the main thing to respond to.
- The transcript is supporting context, not the main subject.
- Err on the side of brevity.
- Do NOT summarize the whole video unless the scribbles clearly ask for broad synthesis.
- Usually produce 1-5 short bullets, not an essay.
- Keep each bullet tight: usually 1-3 sentences.
- If a scribble is messy, infer the likely intent and rewrite it cleanly.
- If a scribble is a question, do NOT assume it wants an answer. Often it should remain an open question, a sharpened question, or a note about uncertainty.
- Preserve uncertainty instead of pretending confidence.
- If the transcript strongly clarifies a scribble, use that context lightly.

## Suggested behavior by scribble type
- question -> preserve it or sharpen it into a better question
- fragment/topic list -> clean it into a concise note or grouped bullets
- claim/reaction -> rewrite it into a clearer observation
- uncertainty -> keep the uncertainty explicit and note what seems plausible

## Output format
Respond with only the rewritten notes in markdown. No preamble, no postface, no explanation.

Good output shape:
- optional short heading only if it genuinely helps
- then a compact bullet list

Bad output shape:
- long recap of the whole transcript
- essay-length summary
- generic filler`;
}

function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
