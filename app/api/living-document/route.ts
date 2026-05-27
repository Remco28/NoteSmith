import { NextRequest, NextResponse } from "next/server";
import { buildLivingDocumentPrompt, createOpenAIClient, OPENAI_MODEL } from "@/lib/openai";
import type { ScribbleEntry, TranscriptSegment } from "@/types/notesmith";

interface GenerateRequestBody {
  transcript?: TranscriptSegment[];
  scribbles?: ScribbleEntry[];
}

export async function POST(request: NextRequest) {
  let body: GenerateRequestBody;

  try {
    body = (await request.json()) as GenerateRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const transcript = Array.isArray(body.transcript) ? body.transcript : [];
  const scribbles = Array.isArray(body.scribbles) ? body.scribbles : [];

  try {
    const client = createOpenAIClient();
    const prompt = buildLivingDocumentPrompt(transcript, scribbles);

    const openAIStream = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [{ role: "user", content: prompt }],
      stream: true,
      temperature: 0.7,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of openAIStream) {
            const text = chunk.choices[0]?.delta?.content ?? "";
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed.";
    const status = message === "OPENAI_API_KEY is not set" ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
