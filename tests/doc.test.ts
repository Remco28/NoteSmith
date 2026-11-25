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
    { sourceIds: ["a", "zzz"], text: "- Who competes with Nvidia?", topic: "## Nvidia:", mergeInto: null, context: null },
    { sourceIds: ["a", "b"], text: "Water per prompt?", topic: "AI", mergeInto: "does-not-exist", context: null },
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
    { sourceIds: ["b"], text: "Nvidia competitors? AMD maybe.", topic: "Nvidia", mergeInto: "n1", context: null },
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

test("transcriptAround takes what was said just before", () => {
  const segs = Array.from({ length: 200 }, (_, i) => ({ start: i * 5, end: i * 5 + 5, text: `w${i}` }));
  const ctx = transcriptAround(segs, 500);
  assert.ok(ctx.includes("w99"));
  assert.ok(ctx.includes("w86"));
  assert.ok(!ctx.includes("w80 "));
  assert.ok(!ctx.includes("w103"));
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

test("context stays apart from the user's words, in the doc and the export", () => {
  const notes = applyRefine([], [s("a", 62, "lol that")], [
    { sourceIds: ["a"], text: "Lol, that.", topic: "Banking", mergeInto: null, context: "(re: naming the bank after a robbed mountain)" },
  ]);
  assert.equal(notes[0].text, "Lol, that.");
  assert.equal(notes[0].context, "naming the bank after a robbed mountain");
  const md = toMarkdown({ notes, updatedAt: 1 }, [s("a", 62, "lol that")], { id: "abcdefghijk", title: "T" });
  assert.match(md, /- Lol, that\. \*\(re: “naming the bank after a robbed mountain”\)\* \(\[1:02\]/);
});

test("a context quote survives only if it was really said just before", async () => {
  const { verifyContext } = await import("@/lib/refine/run");
  const pending = [{ id: "a", time: 62, text: "lol that", context: "", recent: "And the bank is named after the Lonely Mountain, in The Hobbit." }];
  const item = { sourceIds: ["a"], text: "Lol, that.", topic: "Bank", mergeInto: null };
  const [kept] = verifyContext([{ ...item, context: "the bank is named after the lonely mountain in The Hobbit" }], pending);
  assert.equal(kept.context, "the bank is named after the lonely mountain in The Hobbit");
  const [dropped] = verifyContext([{ ...item, context: "naming the bank after a robbed mountain" }], pending);
  assert.equal(dropped.context, null);
  // Whole words only: "he" must not match inside "the".
  const [partial] = verifyContext([{ ...item, context: "he bank is named" }], pending);
  assert.equal(partial.context, null);
  // A scribble that names its own subject never gets an aside.
  const named = [{ ...pending[0], text: "lol thermostats" }];
  const [noAside] = verifyContext([{ ...item, context: "the bank is named after the lonely mountain" }], named);
  assert.equal(noAside.context, null);
});
