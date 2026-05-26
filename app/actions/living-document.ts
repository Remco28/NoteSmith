"use server";

/**
 * Server Action: generate a streaming Living Document rewrite.
 *
 * Input:  transcript segments, scribble entries, answerQuestions flag
 * Output: a ReadableStream of string chunks (markdown text)
 *
 * On failure: throws with a descriptive message.
 * Does NOT stream partial content on error — caller is responsible for
 * preserving prior state on the client side.
 */

import { createOpenAIClient, buildLivingDocumentPrompt, OPENAI_MODEL } from "@/lib/openai";
import type { TranscriptSegment, ScribbleEntry } from "@/types/notesmith";

export async function generateLivingDocument(
  transcript: TranscriptSegment[],
  scribbles: ScribbleEntry[],
  answerQuestions: boolean,
): Promise<ReadableStream<string>> {
  const client = createOpenAIClient();

  const prompt = buildLivingDocumentPrompt(transcript, scribbles, answerQuestions);

  const openAIStream = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [{ role: "user", content: prompt }],
    stream: true,
    temperature: 0.7,
  });

  // Convert OpenAI byte-chunk stream → web ReadableStream of strings
  const webStream = new ReadableStream<string>({
    async start(controller) {
      try {
        for await (const chunk of openAIStream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) {
            // enqueue accepts string | Uint8Array | undefined
            controller.enqueue(text);
          }
        }
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });

  return webStream;
}