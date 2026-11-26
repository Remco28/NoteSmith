import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyRefine,
  emptyDocument,
  needsRefine,
  planRefine,
  sections,
  toMarkdown,
  transcriptAround,
  transcriptForPrompt,
  cleanDetail,
  parseTime,
} from "@/lib/doc";
import type { LivingDocument, Scribble } from "@/types/notesmith";

const s = (id: string, time: number, text: string): Scribble => ({ id, time, text, createdAt: 0 });

test("every new scribble is pending on an empty document; empty ones are skipped", () => {
  const scribbles = [s("b", 20, "second"), s("a", 10, "first"), s("c", 30, "   ")];
  const { kept, pending } = planRefine(scribbles, emptyDocument());
  assert.equal(kept.length, 0);
  assert.deepEqual(pending.map((p) => p.id), ["a", "b"]);
});

test("a note survives only while its scribbles are unchanged", () => {
  const doc: LivingDocument = {
    updatedAt: 1,
    notes: [
      { id: "n1", text: "First.", topic: "T", sources: { a: "first" } },
      { id: "n2", text: "Second and third.", topic: "T", sources: { b: "second", c: "third" } },
    ],
  };
  const scribbles = [s("a", 10, "first"), s("b", 20, "second EDITED"), s("c", 30, "third")];
  const { kept, pending } = planRefine(scribbles, doc);
  assert.deepEqual(kept.map((n) => n.id), ["n1"]);
  // Editing b invalidates n2, so c goes back to pending with it.
  assert.deepEqual(pending.map((p) => p.id), ["b", "c"]);
  assert.equal(needsRefine(scribbles, doc), true);
});

test("deleting a scribble removes its note", () => {
  const doc: LivingDocument = {
    updatedAt: 1,
    notes: [{ id: "n1", text: "First.", topic: "", sources: { a: "first" } }],
  };
  const { kept, pending } = planRefine([], doc);
  assert.equal(kept.length, 0);
  assert.equal(pending.length, 0);
  assert.equal(needsRefine([], doc), true);
});

test("applyRefine keeps every scribble even when the model misbehaves", () => {
  const pending = [s("a", 10, "nvidia competitors??"), s("b", 20, "water per prompt?"), s("c", 30, "missed me")];
  const notes = applyRefine([], pending, [
    { sourceIds: ["a", "zzz"], text: "- Who competes with Nvidia?", topic: "## Nvidia:", mergeInto: null, detail: null },
    { sourceIds: ["a", "b"], text: "Water per prompt?", topic: "AI", mergeInto: "does-not-exist", detail: null },
  ]);
  assert.equal(notes.length, 3);
  const [n1, n2, n3] = notes;
  assert.equal(n1.text, "Who competes with Nvidia?");
  assert.equal(n1.topic, "Nvidia");
  assert.deepEqual(Object.keys(n1.sources), ["a"]);
  // "a" was already used, so only "b" lands in the second note.
  assert.deepEqual(Object.keys(n2.sources), ["b"]);
  assert.equal(n3.unrefined, true);
  assert.equal(n3.text, "missed me");
});

test("merging into an existing note keeps its old sources", () => {
  const kept = [{ id: "n1", text: "Nvidia competitors?", topic: "Nvidia", sources: { a: "x" } }];
  const notes = applyRefine(kept, [s("b", 40, "AMD maybe")], [
    { sourceIds: ["b"], text: "Nvidia competitors? AMD maybe.", topic: "Nvidia", mergeInto: "n1", detail: null },
  ]);
  assert.equal(notes.length, 1);
  assert.deepEqual(Object.keys(notes[0].sources).sort(), ["a", "b"]);
  assert.equal(kept[0].text, "Nvidia competitors?", "input notes are not mutated");
});

test("sections follow the video and group topics case-insensitively", () => {
  const scribbles = [s("a", 100, "x"), s("b", 10, "y"), s("c", 50, "z")];
  const doc: LivingDocument = {
    updatedAt: 1,
    notes: [
      { id: "1", text: "A", topic: "Later", sources: { a: "x" } },
      { id: "2", text: "B", topic: "Early", sources: { b: "y" } },
      { id: "3", text: "C", topic: "later", sources: { c: "z" } },
    ],
  };
  const out = sections(doc, scribbles);
  assert.deepEqual(out.map((x) => x.topic), ["Early", "Later"]);
  assert.deepEqual(out[1].notes.map((n) => n.note.id), ["3", "1"]);
});

test("transcriptAround takes the moment and what came before", () => {
  const segs = Array.from({ length: 200 }, (_, i) => ({ start: i * 5, end: i * 5 + 5, text: `w${i}` }));
  const ctx = ` ${transcriptAround(segs, 500)} `;
  assert.ok(ctx.includes(" w99 "));
  assert.ok(ctx.includes(" w83 "));
  assert.ok(!ctx.includes(" w80 "));
  assert.ok(ctx.includes(" w105 "));
  assert.ok(!ctx.includes(" w108 "));
});

test("the prompt transcript is the whole video in stamped paragraphs", () => {
  const segs = Array.from({ length: 40 }, (_, i) => ({ start: i * 5, end: i * 5 + 5, text: `w${i}\n` }));
  const t = transcriptForPrompt(segs, [100]);
  const lines = t.split("\n");
  assert.equal(lines.length, 7, "30-second paragraphs");
  assert.match(lines[0], /^\[0:00\] w0 w1 w2 w3 w4 w5$/);
  assert.match(lines[1], /^\[0:30\] w6 /);
});

test("a very long transcript is cut to a window around the scribbles", () => {
  // 5 hours of 5-second captions, each about 100 characters.
  const segs = Array.from({ length: 3600 }, (_, i) => ({ start: i * 5, end: i * 5 + 5, text: `s${i} ` + "x".repeat(95) }));
  const t = transcriptForPrompt(segs, [9000]);
  assert.ok(t.length <= 240_000);
  assert.ok(t.includes(" s1800 "), "keeps the scribble's moment");
  assert.ok(!t.includes("[0:00]"), "drops the far start");
});

test("details are tidied, capped and only time-linked when from the video", () => {
  assert.equal(parseTime("12:04"), 724);
  assert.equal(parseTime("[1:02:03]"), 3723);
  assert.equal(parseTime("soon"), undefined);
  assert.equal(cleanDetail({ kind: "video", text: "  " }), undefined);
  assert.deepEqual(cleanDetail({ kind: "video", text: "From the video: they ran both.", at: 90 }, 600), { kind: "video", text: "they ran both.", at: 90 });
  assert.equal(cleanDetail({ kind: "video", text: "x", at: 9999 }, 600)?.at, undefined, "a time past the end is dropped");
  assert.equal(cleanDetail({ kind: "general", text: "x", at: 30 })?.at, undefined);
  const long = cleanDetail({ kind: "answer", text: "One sentence here. ".repeat(40) })!;
  assert.ok(long.text.length <= 360 && long.text.endsWith("."));
});

test("markdown export links each note to its moment", () => {
  const doc: LivingDocument = {
    updatedAt: 1,
    notes: [{ id: "1", text: "Who competes with Nvidia?", topic: "Nvidia", sources: { a: "x" } }],
  };
  const md = toMarkdown(doc, [s("a", 724, "x")], { id: "abcdefghijk", title: "A talk" }, { includeScribbles: true });
  assert.match(md, /^# A talk/);
  assert.match(md, /## Nvidia/);
  assert.match(md, /- Who competes with Nvidia\? \(\[12:04\]\(https:\/\/youtu\.be\/abcdefghijk\?t=724\)\)/);
  assert.match(md, /## Raw scribbles\n\n- 12:04 x/);
});

test("a detail stays apart from the user's words, in the doc and the export", () => {
  const notes = applyRefine([], [s("a", 62, "what is erebor?")], [
    {
      sourceIds: ["a"],
      text: "What is Erebor?",
      topic: "Banking",
      mergeInto: null,
      detail: { kind: "answer", text: "The bank, named after the Lonely Mountain.", at: 58 },
    },
  ]);
  assert.equal(notes[0].text, "What is Erebor?");
  assert.deepEqual(notes[0].detail, { kind: "answer", text: "The bank, named after the Lonely Mountain.", at: 58 });
  const md = toMarkdown({ notes, updatedAt: 1 }, [s("a", 62, "what is erebor?")], { id: "abcdefghijk", title: "T" });
  assert.match(md, /- What is Erebor\? \(\[1:02\]\(https:\/\/youtu\.be\/abcdefghijk\?t=62\)\)\n  - \*Answer \(\[0:58\]\(https:\/\/youtu\.be\/abcdefghijk\?t=58\)\):\* The bank/);
});

test("a merge replaces the old detail, or removes it", () => {
  const kept = [{ id: "n1", text: "Q?", topic: "T", sources: { a: "q?" }, detail: { kind: "general" as const, text: "old" } }];
  const notes = applyRefine(kept, [s("b", 40, "also r")], [
    { sourceIds: ["b"], text: "Q? Also R.", topic: "T", mergeInto: "n1", detail: null },
  ]);
  assert.equal(notes[0].detail, undefined);
});

test("what the bookmark sends is read back, and anything else is refused", async () => {
  const { readImport, IMPORT_PREFIX, bookmarkletHref } = await import("@/lib/bookmarklet");
  const payload = { v: 1, id: "9oNvKMd7xJo", title: "A talk", author: "Someone", source: "uploaded", lang: "en", segs: [[0.1, 1.8, "So we rebuilt it"], [1.8, 3, "in Rust."]] };
  const gz = new Response(new Blob([JSON.stringify(payload)]).stream().pipeThrough(new CompressionStream("gzip")));
  const b64 = Buffer.from(await gz.arrayBuffer()).toString("base64url");
  const got = await readImport(IMPORT_PREFIX + b64);
  assert.equal(got?.id, "9oNvKMd7xJo");
  assert.equal(got?.source, "uploaded");
  assert.deepEqual(got?.segments[1], { start: 1.8, end: 3, text: "in Rust." });
  assert.equal(await readImport("#import=not-gzip"), null);
  assert.equal(await readImport("#other"), null);
  const bad = { ...payload, id: "../../etc" };
  const gz2 = new Response(new Blob([JSON.stringify(bad)]).stream().pipeThrough(new CompressionStream("gzip")));
  assert.equal(await readImport(IMPORT_PREFIX + Buffer.from(await gz2.arrayBuffer()).toString("base64url")), null);
  const href = bookmarkletHref("https://example.github.io/NoteSmith/");
  assert.ok(href.startsWith("javascript:"));
  assert.ok(decodeURIComponent(href).includes('const APP = "https://example.github.io/NoteSmith/"'));
  // The bookmark's code must parse as JavaScript.
  new Function(decodeURIComponent(href).slice("javascript:".length));
});
