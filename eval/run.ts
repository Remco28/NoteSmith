/**
 * Note-quality eval. Plays a fixture's scribbles through the real refine
 * step in the same rounds the app would, then scores every note.
 *
 *   npx tsx eval/run.ts [fixture.json] [--model claude-haiku-5-5] [--no-judge]
 *
 * Needs ANTHROPIC_API_KEY (read from .env.local). Writes a readable report to
 * eval/out/. Deterministic checks run always; a second model (the judge)
 * flags notes that add, drop or answer things.
 */

import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { fetchTranscript } from "@/lib/transcript/adapter";
import {
  applyRefine,
  emptyDocument,
  formatTime,
  planRefine,
  sections,
  toExistingNotes,
  toPending,
  transcriptAround,
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
const fixturePath = args.find((a) => a.endsWith(".json")) ?? "eval/palmer-luckey.json";
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
  if (pending.length === 0) return { doc: { notes: kept, updatedAt: Date.now() }, ms: 0, tokens: [0, 0] };
  const t0 = Date.now();
  const res = await refine(
    {
      provider: "anthropic",
      model,
      video: { title: fixture.video.title, author: fixture.video.author },
      notes: toExistingNotes(kept, scribbles),
      pending: toPending(pending, transcript),
    },
    apiKey!,
  );
  const notes = applyRefine(kept, pending, res.items, res.moves);
  return {
    doc: { notes, updatedAt: Date.now() },
    ms: Date.now() - t0,
    tokens: [res.usage.inputTokens, res.usage.outputTokens],
    missing: res.missing,
    moves: res.moves.length,
  };
}

/* ---------- checks ---------- */

interface Verdict { verdict: "good" | "minor" | "bad"; problems: string[] }

const judgeClient = new Anthropic({ apiKey });

async function judge(note: Note, srcs: Scribble[], transcript: TranscriptSegment[]): Promise<Verdict> {
  const scribbleText = srcs.map((s) => `[${formatTime(s.time)}] ${s.text}`).join("\n");
  const context = srcs.map((s) => transcriptAround(transcript, s.time)).join("\n---\n");
  const prompt = `A note-taking app turns a viewer's messy scribbles into clean notes. The note must say what the scribble said, in the viewer's voice, and nothing more. It may fix spelling and names, clarify a terse scribble with a few words of context, and shorten rambling. It must not add facts or background, summarize the video, answer the viewer's questions, drop anything the scribble said (ideas, names, numbers, questions, doubts, opinions), or turn doubt into certainty.

Scribble(s):
${scribbleText}

Transcript just before (for context only):
${context}

Note: "${note.text}"   (topic: "${note.topic}")${note.context ? `
Shown beside the note, visibly marked as transcript context rather than the viewer's words: "(re: ${note.context})". This is allowed only for a scribble that points at something without naming it ("lol that", "this", "wait what"), and only if it accurately says what was being said in the seconds before the scribble. Judge it on that.` : ""}

Judge the note strictly. List each concrete problem in a few words. verdict: "good" (no problems), "minor" (small wording issue a user would barely notice), "bad" (adds or drops content, answers a question, removes doubt, or is much longer than needed).`;

  const response = await judgeClient.beta.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "medium",
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            problems: { type: "array", items: { type: "string" } },
            verdict: { type: "string", enum: ["good", "minor", "bad"] },
          },
          required: ["problems", "verdict"],
          additionalProperties: false,
        },
      },
    },
    messages: [{ role: "user", content: prompt }],
  } as Anthropic.Beta.MessageCreateParamsNonStreaming);
  if (response.stop_reason === "refusal") return { verdict: "minor", problems: ["judge refused"] };
  const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return JSON.parse(text) as Verdict;
}

function lengthFlag(note: Note, srcs: Scribble[]): string | null {
  const src = srcs.reduce((n, s) => n + s.text.length, 0);
  const limit = Math.max(src * 2.2, src + 70);
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
  let good = 0, minor = 0, bad = 0, flags = 0;
  log.push("## Rounds", "", ...stableCheck.map((l) => `- ${l}`), "", "## Notes", "");

  const verdicts = await Promise.all(
    doc.notes.map((note) => {
      const srcs = Object.keys(note.sources).map((id) => byId.get(id)!).filter(Boolean);
      return useJudge ? judge(note, srcs, transcript).catch((e) => ({ verdict: "minor", problems: [`judge error: ${e.message}`] }) as Verdict) : Promise.resolve(null);
    }),
  );
  const verdictById = new Map(doc.notes.map((n, i) => [n.id, verdicts[i]]));

  for (const section of sections(doc, scribbles)) {
    log.push(`### ${section.topic || "(no topic)"}`, "");
    for (const { note } of section.notes) {
      const srcs = Object.keys(note.sources).map((id) => byId.get(id)!).filter(Boolean);
      const v = verdictById.get(note.id);
      const autoFlags = [lengthFlag(note, srcs), questionFlag(note, srcs), note.unrefined ? "UNREFINED" : null].filter(Boolean);
      flags += autoFlags.length;
      if (v?.verdict === "good") good++;
      else if (v?.verdict === "minor") minor++;
      else if (v?.verdict === "bad") bad++;
      for (const src of srcs) log.push(`- scribble ${formatTime(src.time)}: ${src.text}`);
      log.push(`  - **note:** ${note.text}${note.context ? ` *(re: ${note.context})*` : ""}`);
      if (v) log.push(`  - judge: **${v.verdict}**${v.problems.length ? ` (${v.problems.join("; ")})` : ""}`);
      if (autoFlags.length) log.push(`  - flags: ${autoFlags.join("; ")}`);
      log.push("");
    }
  }

  const summary = `${doc.notes.length} notes from ${scribbles.length} scribbles · judge good ${good} / minor ${minor} / bad ${bad} · auto-flags ${flags} · topics ${sections(doc, scribbles).length}`;
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
