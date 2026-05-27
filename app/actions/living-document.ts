"use server";

/**
 * Legacy server action helper retained only as a thin wrapper.
 *
 * Input: transcript segments and scribble entries.
 * Output: a ReadableStream of string chunks (markdown text)
 */

import { createOpenAIClient, buildLivingDocumentPrompt, OPENAI_MODEL } from "@/lib/openai";
import type { TranscriptSegment, ScribbleEntry } from "@/types/notesmith";

export async function generateLivingDocument(
  transcript: TranscriptSegment[],
  scribbles: ScribbleEntry[],
): Promise<ReadableStream<string>> {
  const client = createOpenAIClient();

  const prompt = buildLivingDocumentPrompt(transcript, scribbles);

  const openAIStream = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [{ role: "user", content: prompt }],
    stream: true,
    temperature: 0.7,
  });

  const webStream = new ReadableStream<string>({
    async start(controller) {
      try {
        for await (const chunk of openAIStream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) {
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
