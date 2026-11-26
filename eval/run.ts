/**
 * Note-quality eval. Plays a fixture's scribbles through the real refine
 * step in the same rounds the app would, then scores every note.
 *
 *   npx tsx eval/run.ts [fixture.json] [--model claude-haiku-5-5] [--no-judge]
 *
 * Needs ANTHROPIC_API_KEY (read from .env.local). Writes a readable report to
 * eval/out/. Deterministic checks run always; a second model (the judge),
 * given the whole transcript, flags notes that say too much (unfaithful,
 * inaccurate details) or too little (still vague, a needed detail missing).
 */

import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { fetchTranscript } from "./lib/youtube";
import {
  applyRefine,
  emptyDocument,
  formatTime,
  planRefine,
  sections,
  toExistingNotes,
  toPending,
  transcriptForPrompt,
} from "@/lib/doc";
import { refine } from "@/lib/refine/run";
import type { LivingDocument, Note, Scribble, TranscriptSegment } from "@/types/notesmith";

/* ---------- setup ---------- */

for (const line of fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8").split("\n") : []) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing (.env.local)");

const args = process.argv.slice(2);
const fixturePath = args.find((a) => a.endsWith(".json")) ?? "eval/katelyn-lesse.json";
const model = args.includes("--model") ? args[args.indexOf("--model") + 1] : "claude-haiku-5-5";
const useJudge = !args.includes("--no-judge");
const JUDGE_MODEL = "claude-sonnet-5-5";

interface FixtureScribble { id: string; time: number; batch: number; text: string; editTo?: string }
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as {
  video: { id: string; title: string; author: string };
  scribbles: FixtureScribble[];
};

async function loadTranscript(videoId: string): Promise<TranscriptSegment[]> {
  const cache = path.join("eval", ".cache", `${videoId}.json`);
  if (fs.existsSync(cache)) return JSON.parse(fs.readFileSync(cache, "utf8"));
  const { segments } = await fetchTranscript(videoId, "en");
  fs.mkdirSync(path.dirname(cache), { recursive: true });
  fs.writeFileSync(cache, JSON.stringify(segments));
  return segments;
}

/* ---------- play the session ---------- */

async function forge(scribbles: Scribble[], doc: LivingDocument, transcript: TranscriptSegment[]) {
  const { kept, pending } = planRefine(scribbles, doc);
  if (pending.length === 0) return { doc: { notes: kept, updatedAt: Date.now() }, ms: 0, tokens: [0, 0, 0] };
  const t0 = Date.now();
  const res = await refine(
    {
      provider: "anthropic",
      model,
      video: { title: fixture.video.title, author: fixture.video.author },
      notes: toExistingNotes(kept, scribbles),
      pending: toPending(pending),
      transcript: transcriptForPrompt(transcript, pending.map((s) => s.time)),
    },
    apiKey!,
  );
  const notes = applyRefine(kept, pending, res.items, res.moves, transcript.at(-1)?.end);
  return {
    doc: { notes, updatedAt: Date.now() },
    ms: Date.now() - t0,
    tokens: [res.usage.inputTokens, res.usage.outputTokens, res.usage.cachedTokens ?? 0],
    missing: res.missing,
    moves: res.moves.length,
  };
}

/* ---------- checks ---------- */

interface Verdict {
  verdict: "good" | "minor" | "bad";
  /** The note's text no longer says what the viewer thought (added claims, lost doubt, changed stance, answered a question). */
  unfaithful: boolean;
  /** The note is still as vague or terse as the scribble where the transcript makes the meaning clear. */
  tooLiteral: boolean;
  detail: "ok" | "none-fine" | "missing" | "unneeded" | "inaccurate" | "wrong-kind";
  problems: string[];
}

const judgeClient = new Anthropic({ apiKey });

const JUDGE_RULES = `A note-taking app turns a viewer's messy scribbles, written while watching a video, into notes they can reread later without rewatching. Each note has two parts:

TEXT: the viewer's own thought, made readable and self-contained. It may replace vague references ("they", "it", "the models") with who or what the video was talking about, fix wording and names, and turn fragments into sentences; light edits only when the scribble already reads well. It must keep the viewer's stance, opinions, doubt ("??", "I think", "we'll see"), questions, attribution ("she says"), emphasis and numbers. It must not add facts or reasons beyond the words that name what was meant, and must not answer questions.

DETAIL (optional, shown under the note and labeled, so it never reads as the viewer's words), one of:
- video: what the speakers actually said that the note refers to, when it saves the viewer from re-listening. Must be accurate to the transcript (including who said what: host vs guest), at most ~40 words, and add something beyond the note. People named in the video title must be spelled as in the title.
- answer: the video's answer to a real question the viewer asked to learn something.
- general: a short general-knowledge answer to a real question the video doesn't answer. Must be correct.
A pure reaction with no subject of its own ("lol that", "this", "wait what") keeps the reaction as its text, by design: what it reacted to belongs in a "video" detail, never in the text, and no detail is right when the moment is unclear. Don't call such a text too literal.
Rhetorical, emotional or thinking-out-loud questions ("should we be scared?") must not be answered. Doubt about a claim gets a neutral "video" detail, not a verdict. A detail never argues with the viewer's opinion.

The level of filling-in the viewer wants, in their own words: "high trust in the models to get it right" should become something like "Anthropic developers trust the models to get the code right", naming who trusts what. Naming the subject this way is required, not an addition. So is using the video's names and terms.

If the viewer corrects their own earlier scribble, the note follows the viewer's correction even if the video says otherwise; a detail may show what the video said. That is faithful, not an error.

Both failures matter equally:
- Too much: the text says things the viewer didn't think, loses their doubt or voice, or the detail is inaccurate, invented, or just restates the note.
- Too little: the text is still as vague as the scribble when the transcript makes the meaning clear (a fragment with no subject, or "they", "she", "it" left unexplained, counts), or a detail is missing where it would clearly save the viewer from re-listening (what an approach was, what a term means, a question the video answers).`;

async function judge(note: Note, srcs: Scribble[], transcriptText: string): Promise<Verdict> {
  const scribbleText = srcs.map((s) => `[${formatTime(s.time)}] ${s.text}`).join("\n");
  const d = note.detail;
  const detail = d ? `${d.kind}${d.at !== undefined ? ` (cites ${formatTime(d.at)})` : ""}: "${d.text}"` : "(none)";
  const prompt = `Video title: "${fixture.video.title}" (names in the title are spelled correctly; the captions may misspell them).

Scribble(s), at the video time they were written:
${scribbleText}

Note text: "${note.text}"   (topic: "${note.topic}")
Detail: ${detail}

Judge this note strictly against the rules, using the transcript. List each concrete problem in a few words.
verdict: "good" (no problems), "minor" (small issue a user would barely notice), "bad" (a clear failure of either kind).
detail: "ok" (present and right), "none-fine" (absent, and nothing was needed), "missing" (absent but clearly needed), "unneeded" (present but adds nothing), "inaccurate" (not what the transcript says, or a wrong general answer), "wrong-kind" (e.g. answers a rhetorical question, or general knowledge when the video answers it).`;

  const response = await judgeClient.beta.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 6000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: JUDGE_RULES,
    output_config: {
      effort: "medium",
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            problems: { type: "array", items: { type: "string" } },
            unfaithful: { type: "boolean" },
            tooLiteral: { type: "boolean" },
            detail: { type: "string", enum: ["ok", "none-fine", "missing", "unneeded", "inaccurate", "wrong-kind"] },
            verdict: { type: "string", enum: ["good", "minor", "bad"] },
          },
          required: ["problems", "unfaithful", "tooLiteral", "detail", "verdict"],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: `<transcript>\n${transcriptText}\n</transcript>`, cache_control: { type: "ephemeral" } },
          { type: "text", text: prompt },
        ],
      },
    ],
  } as Anthropic.Beta.MessageCreateParamsNonStreaming);
  if (response.stop_reason === "refusal") {
    return { verdict: "minor", unfaithful: false, tooLiteral: false, detail: "ok", problems: ["judge refused"] };
  }
  const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return JSON.parse(text) as Verdict;
}

function lengthFlag(note: Note, srcs: Scribble[]): string | null {
  const src = srcs.reduce((n, s) => n + s.text.length, 0);
  const limit = Math.max(src * 1.6, src + 110);
  return note.text.length > limit ? `long: ${note.text.length} chars from ${src}` : null;
}

function questionFlag(note: Note, srcs: Scribble[]): string | null {
  return srcs.some((s) => s.text.includes("?")) && !note.text.includes("?") ? "question mark dropped" : null;
}

/* ---------- main ---------- */

async function main() {
  const transcript = await loadTranscript(fixture.video.id);
  const batches = [...new Set(fixture.scribbles.map((s) => s.batch))].sort((a, b) => a - b);
  let scribbles: Scribble[] = [];
  let doc = emptyDocument();
  const log: string[] = [`# Eval: ${fixture.video.title}`, "", `Model: ${model}`, ""];
  const stableCheck: string[] = [];

  for (const b of batches) {
    const before = new Map(doc.notes.map((n) => [n.id, n.text]));
    scribbles = [
      ...scribbles,
      ...fixture.scribbles.filter((s) => s.batch === b).map((s) => ({ id: s.id, time: s.time, text: s.text, createdAt: 0 })),
    ];
    const r = await forge(scribbles, doc, transcript);
    doc = r.doc;
    const changed = [...before.keys()].filter((id) => doc.notes.find((n) => n.id === id)?.text !== before.get(id));
    stableCheck.push(`round ${b}: ${r.ms} ms, tokens in/out ${r.tokens.join("/")}, earlier notes rewritten: ${changed.length}, moved: ${r.moves ?? 0}`);
  }

  // Edit round
  const edits = fixture.scribbles.filter((s) => s.editTo);
  if (edits.length) {
    scribbles = scribbles.map((s) => {
      const e = edits.find((x) => x.id === s.id);
      return e ? { ...s, text: e.editTo! } : s;
    });
    const r = await forge(scribbles, doc, transcript);
    doc = r.doc;
    stableCheck.push(`edit round: ${r.ms} ms, tokens in/out ${r.tokens.join("/")}`);
  }

  const byId = new Map(scribbles.map((s) => [s.id, s]));
  let good = 0, minor = 0, bad = 0, flags = 0, unfaithful = 0, literal = 0, withDetail = 0;
  const detailTally: Record<string, number> = {};
  log.push("## Rounds", "", ...stableCheck.map((l) => `- ${l}`), "", "## Notes", "");

  const fullText = transcriptForPrompt(transcript, []);
  // The first call writes the judge's transcript cache; the rest read it.
  const judgeOne = (note: Note) => {
    const srcs = Object.keys(note.sources).map((id) => byId.get(id)!).filter(Boolean);
    return judge(note, srcs, fullText).catch(
      (e) => ({ verdict: "minor", unfaithful: false, tooLiteral: false, detail: "ok", problems: [`judge error: ${e.message}`] }) as Verdict,
    );
  };
  const verdicts: Array<Verdict | null> = [];
  if (useJudge && doc.notes.length) {
    verdicts.push(await judgeOne(doc.notes[0]));
    verdicts.push(...(await Promise.all(doc.notes.slice(1).map(judgeOne))));
  }
  const verdictById = new Map(doc.notes.map((n, i) => [n.id, verdicts[i]]));

  for (const section of sections(doc, scribbles)) {
    log.push(`### ${section.topic || "(no topic)"}`, "");
    for (const { note } of section.notes) {
      const srcs = Object.keys(note.sources).map((id) => byId.get(id)!).filter(Boolean);
      const v = verdictById.get(note.id);
      const autoFlags = [lengthFlag(note, srcs), questionFlag(note, srcs), note.unrefined ? "UNREFINED" : null].filter(Boolean);
      flags += autoFlags.length;
      if (v) {
        if (v.unfaithful) unfaithful++;
        if (v.tooLiteral) literal++;
        detailTally[v.detail] = (detailTally[v.detail] ?? 0) + 1;
      }
      if (note.detail) withDetail++;
      if (v?.verdict === "good") good++;
      else if (v?.verdict === "minor") minor++;
      else if (v?.verdict === "bad") bad++;
      for (const src of srcs) log.push(`- scribble ${formatTime(src.time)}: ${src.text}`);
      log.push(`  - **note:** ${note.text}`);
      if (note.detail) {
        const at = note.detail.at !== undefined ? ` @${formatTime(note.detail.at)}` : "";
        log.push(`  - *${note.detail.kind}${at}:* ${note.detail.text}`);
      }
      if (v) {
        const tags = [v.unfaithful ? "UNFAITHFUL" : "", v.tooLiteral ? "TOO LITERAL" : "", `detail ${v.detail}`].filter(Boolean).join(", ");
        log.push(`  - judge: **${v.verdict}** [${tags}]${v.problems.length ? ` (${v.problems.join("; ")})` : ""}`);
      }
      if (autoFlags.length) log.push(`  - flags: ${autoFlags.join("; ")}`);
      log.push("");
    }
  }

  const tally = Object.entries(detailTally).map(([k, n]) => `${k} ${n}`).join(", ");
  const summary =
    `${doc.notes.length} notes from ${scribbles.length} scribbles (${withDetail} with detail) · judge good ${good} / minor ${minor} / bad ${bad}` +
    ` · unfaithful ${unfaithful} · too literal ${literal} · detail: ${tally || "-"} · auto-flags ${flags} · topics ${sections(doc, scribbles).length}`;
  log.splice(4, 0, `**${summary}**`, "");
  fs.mkdirSync("eval/out", { recursive: true });
  const out = path.join("eval/out", `${path.basename(fixturePath, ".json")}-${model}-${Date.now()}.md`);
  fs.writeFileSync(out, log.join("\n"));
  console.log(summary);
  console.log(stableCheck.join("\n"));
  console.log("report:", out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
