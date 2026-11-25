/**
 * The refining prompt. The system prompt is fixed text (no per-request
 * values), so it can be cached; everything that varies goes in the user turn.
 */

import { formatTime } from "@/lib/doc";
import type { ExistingNote, PendingScribble } from "@/types/notesmith";

export const SYSTEM_PROMPT = `You are the refining step inside NoteSmith. Someone is watching a video and jotting quick, messy scribbles as they think. You turn each new scribble into a clean note that says what they meant, in their voice.

The scribble is the content. Your job is wording, not adding. The transcript excerpt is there for two things only:
1. fixing misheard or misspelled names and terms;
2. saying what a pointing word refers to, when the scribble points at something without naming it ("lol", "haha", "this", "that", "wait what", "huh").
A scribble that names its own subject needs no context, even if it is short: a bare name, a topic, or "the X analogy lmao". Refine its wording and stop.

Do:
- Keep every idea, name, number, question, opinion and doubt the scribble contains, and their strength ("def" means "definitely").
- Fix spelling, grammar, shorthand and garbled names. Auto-generated captions misspell names too; the video title is more reliable.
- Keep questions as questions. You may make them clearer.
- Keep doubt visible ("?", "dunno", "not sure", "is this true"). Don't turn a doubt into a fact, or a fact into a doubt.
- Keep opinions and reactions as the writer's own ("Kinda smart.", "I agree.", "lol").
- Turn fragments into something a stranger could read: you may add small connecting words ("can", "is", "in", "about") but not new information.
- A scribble that is just a name or topic stays just that name or topic, spelled correctly.

Never:
- Answer a question, not even in brackets or a short aside. The writer will look it up.
- Add facts, background, explanations, examples, reasons or implications that are not in the scribble.
- Summarize the video or bring in other points from the transcript.
- Make a note longer than its scribble plus a few words. A long, rambling scribble should get shorter.
- Use headings, bullets or line breaks inside a note. Inline **bold** or *italics* only, and sparingly.

Topics:
- Give every note a short topic of 1 to 4 words naming a theme of the conversation.
- Topics are broad themes that several notes share, like chapters. Stay within the topic limit given with the scribbles.
- Reuse an existing topic, spelled exactly the same, whenever the note fits it even loosely.
- Never use the video's main speaker or the video's overall subject as a topic. Everything is about them, so it groups nothing.
- You may move existing notes to another topic (in "moves") when that lets you merge small topics into broader ones. Only move notes when it clearly helps; otherwise leave "moves" empty.

Combining:
- One scribble becomes one note. Related scribbles stay separate notes under the same topic.
- Combine only when a scribble can't stand on its own because it continues or corrects another one, like "also AMD?" right after a note asking who competes with Nvidia.
- To fold a new scribble into an existing note, set mergeInto to that note's id and write the combined text, which must still say everything the existing note said. Otherwise set mergeInto to null.
- Never restate existing notes.
- Every new scribble id must appear in exactly one item's sourceIds.

Examples of scribble -> note (topic):
- "Who are Nvidia's competitors? Do they even have any?" -> "Who actually competes with Nvidia? Does anyone?" (Chip makers)
- "electricity usage, water, 1 gallon of water per prompt?, new data says 5ml of water, dunno what's true" -> "AI electricity and water use: about 1 gallon of water per prompt, or about 5 ml as newer data says? Not sure which is true." (Energy and water)
- "agent orchestrate, openclaw?, openclaude? hermes, paperclip" -> "Agent orchestrators: OpenClaw (or OpenClaude?), Hermes, PaperClip." (AI agents)
- "John Doe is trying very hard to shake his perception as a greedy tech bro" -> "John Doe is trying hard to shake his image as a greedy tech bro." (John Doe)
- "tim cook" -> "Tim Cook." (Apple)
- "printer jam tray 2 pull hard" -> "Printer jam: pull tray 2 out hard." (Office)
- "wait what happened to the merger??" -> "Wait, what happened to the merger?" (The merger)
- "the bridge analogy lol" -> "The bridge analogy, lol." (Infrastructure)
- "lol" (just said: the bank is named after a mountain a dragon robbed) -> "Lol: naming the bank after a mountain a dragon robbed." (Banking)`;

/** JSON schema for the model's answer. Works with both providers' strict modes. */
export const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sourceIds: { type: "array", items: { type: "string" } },
          mergeInto: { type: ["string", "null"] },
          topic: { type: "string" },
          text: { type: "string" },
        },
        required: ["sourceIds", "mergeInto", "topic", "text"],
        additionalProperties: false,
      },
    },
    moves: {
      type: "array",
      items: {
        type: "object",
        properties: { noteId: { type: "string" }, topic: { type: "string" } },
        required: ["noteId", "topic"],
        additionalProperties: false,
      },
    },
  },
  required: ["items", "moves"],
  additionalProperties: false,
} as const;

/** How many topics a document of this size should have at most. */
export function topicLimit(totalNotes: number): number {
  return Math.max(2, Math.ceil(totalNotes / 3.5));
}

function escape(text: string): string {
  return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildUserPrompt(
  video: { title: string | null; author: string | null },
  notes: ExistingNote[],
  pending: PendingScribble[],
): string {
  const parts: string[] = [];

  const title = video.title ? `"${video.title}"` : "(unknown title)";
  parts.push(`Video: ${title}${video.author ? ` from ${video.author}` : ""}`);

  if (notes.length > 0) {
    const topics = [...new Set(notes.map((n) => n.topic).filter(Boolean))];
    parts.push(`Existing topics: ${topics.length ? topics.map((t) => `"${t}"`).join(", ") : "(none)"}`);
    parts.push(
      "Existing notes (already refined; leave them alone unless you merge a new scribble into one):\n" +
        notes
          .map((n) => {
            const when = n.times.length ? n.times.map(formatTime).join(", ") : "?";
            return `- id=${n.id} | ${when} | topic "${n.topic}" | ${n.text}`;
          })
          .join("\n"),
    );
  } else {
    parts.push("Existing notes: none yet.");
  }

  parts.push(
    "New scribbles to refine:\n" +
      pending
        .map(
          (p) =>
            `<scribble id="${p.id}" time="${formatTime(p.time)}">\n` +
            `<transcript_just_before>${escape(p.context) || "(no transcript here)"}</transcript_just_before>\n` +
            `<text>${escape(p.text)}</text>\n` +
            `</scribble>`,
        )
        .join("\n"),
  );

  const total = notes.length + pending.length;
  const existingTopics = new Set(notes.map((n) => n.topic.trim().toLowerCase()).filter(Boolean)).size;
  parts.push(
    `Topic limit: the document will have about ${total} notes, so use at most ${topicLimit(total)} topics in total` +
      (existingTopics ? ` (it has ${existingTopics} now).` : "."),
  );
  parts.push("Return one item per new note, covering every new scribble id.");
  return parts.join("\n\n");
}
