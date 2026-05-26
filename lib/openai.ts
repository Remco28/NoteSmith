/**
 * OpenAI client wrapper for NoteSmith.
 * Default model: gpt-4o. Override with OPENAI_MODEL env var.
 */

import OpenAI from "openai";

export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o";

export function createOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({ apiKey });
}

/**
 * Build the user-message prompt for a whole-document rewrite.
 */
export function buildLivingDocumentPrompt(
  transcriptSegments: Array<{ start: number; end: number; text: string }>,
  scribbles: Array<{ id: string; text: string; timestamp: number }>,
  answerQuestions: boolean,
): string {
  const transcriptText = transcriptSegments
    .map((s) => `[${formatSeconds(s.start)}] ${s.text}`)
    .join("\n");

  const scribblesText = scribbles
    .map((s) => `[${formatSeconds(s.timestamp)}] ${s.text}`)
    .join("\n");

  const questionDirective = answerQuestions
    ? `After rewriting the transcript as a clean document, also answer any questions raised by the scribbles. Treat the scribbles as both notes AND questions/insights to address.`
    : `Rewrite the transcript as a clean, well-structured document. Treat the scribbles as editorial notes and incorporate relevant insights into the document naturally. Do not merely summarize — synthesize.`;

  return `You are NoteSmith, an AI thinking partner. You are given a YouTube video transcript and the viewer's raw scribbled notes.

## Transcript
${transcriptText}

## Scribbled Notes
${scribblesText}

## Task
${questionDirective}

## Output format
Respond with only the rewritten document in markdown. No preamble, no postface, no explanation. Start immediately with the title or opening.`;
}

function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}