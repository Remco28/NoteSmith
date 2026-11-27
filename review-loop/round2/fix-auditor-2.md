**Ctrl+Z can erase scribbles added after a delete.** Round 2 also leaves gaps in quote verification, makes the workspace unusable at some landscape phone sizes, and can leave forging blocked after a settings save.

### 1. Context asides — partial

Fresh settings default to off, and a merge now replaces or clears the previous aside. Saved preferences still take effect. [storage.ts](/home/frank/.cache/notesmith-review/r1/fixaudit2-copy/lib/storage.ts:19) · [doc.ts](/home/frank/.cache/notesmith-review/r1/fixaudit2-copy/lib/doc.ts:187)

- **MEDIUM — The verifier accepts altered quotes and asides on named subjects.** It accepts `he said it was stolen` from `she said it was stolen` because it searches inside words. It also accepts punctuation changes that can reverse the meaning. The reaction-only rule is enforced by the prompt alone, so a model-supplied quote for `lol thermostats` passes if the words appear in the excerpt. [run.ts](/home/frank/.cache/notesmith-review/r1/fixaudit2-copy/lib/refine/run.ts:50) · [prompt.ts](/home/frank/.cache/notesmith-review/r1/fixaudit2-copy/lib/refine/prompt.ts:13)
- **MEDIUM — The 15-second window includes text outside both boundaries.** At 1:02, the browser sends a whole caption that starts at 1:02 and runs to 1:06. It also sends the whole caption when it overlaps the start of the window. The API receives a plain string, so the server cannot enforce the timing independently. [doc.ts](/home/frank/.cache/notesmith-review/r1/fixaudit2-copy/lib/doc.ts:90) · [refine route](/home/frank/.cache/notesmith-review/r1/fixaudit2-copy/app/api/refine/route.ts:58)
- **MEDIUM — Old paraphrases are now presented as quotes.** Reopen a saved document with a previously generated paraphrase and leave `showContext` on or enable it. The app loads the old aside unchanged, then adds quotation marks in the document and Markdown export. [storage.ts](/home/frank/.cache/notesmith-review/r1/fixaudit2-copy/lib/storage.ts:84) · [DocPanel.tsx](/home/frank/.cache/notesmith-review/r1/fixaudit2-copy/components/DocPanel.tsx:256) · [doc.ts](/home/frank/.cache/notesmith-review/r1/fixaudit2-copy/lib/doc.ts:282)

### 2. Prompt — partial

- **LOW — The correction and italics instructions landed, but an example still contradicts the prompt.** The John Doe example changes “trying very hard” to “trying hard” despite the instruction to preserve the writer’s strength of expression. [prompt.ts](/home/frank/.cache/notesmith-review/r1/fixaudit2-copy/lib/refine/prompt.ts:17) · [correction rule](/home/frank/.cache/notesmith-review/r1/fixaudit2-copy/lib/refine/prompt.ts:48) · [example](/home/frank/.cache/notesmith-review/r1/fixaudit2-copy/lib/refine/prompt.ts:57)

### 3. Transcript — landed

Focusing a line pins its Tab stop as playback advances. Leaving the group releases it, and the container uses `role="group"`. I found no focus loop in that path. [TranscriptPanel.tsx](/home/frank/.cache/notesmith-review/r1/fixaudit2-copy/components/TranscriptPanel.tsx:127) · [focus handlers](/home/frank/.cache/notesmith-review/r1/fixaudit2-copy/components/TranscriptPanel.tsx:172)

### 4. Delete, undo, and labels — partial

Delete focuses the composer when it is present. Edit and delete buttons identify their scribble, and both kinds of seek chip say “just before.” The shortcut is wired and expires after 10 seconds. [Workspace.tsx](/home/frank/.cache/notesmith-review/r1/fixaudit2-copy/components/Workspace.tsx:364) · [ScribblesPanel.tsx](/home/frank/.cache/notesmith-review/r1/fixaudit2-copy/components/ScribblesPanel.tsx:145) · [seek chip](/home/frank/.cache/notesmith-review/r1/fixaudit2-copy/components/ScribblesPanel.tsx:82) · [DocPanel.tsx](/home/frank/.cache/notesmith-review/r1/fixaudit2-copy/components/DocPanel.tsx:277)

- **HIGH — Undo can silently discard newer work.** Delete A, add C, move focus outside the composer, and press Ctrl+Z within 10 seconds. A returns and C disappears. The old toast already restored the entire scribble and document snapshot. The new shortcut exposes the same data loss, including edits and forge results made after the delete. [Workspace.tsx](/home/frank/.cache/notesmith-review/r1/fixaudit2-copy/components/Workspace.tsx:352)
- **MEDIUM — An older toast can disable the shortcut for a newer delete.** Delete A, delete B, then click A’s still-visible Undo toast. Its callback clears the shared shortcut, so Ctrl+Z can no longer undo B within its window. [Workspace.tsx](/home/frank/.cache/notesmith-review/r1/fixaudit2-copy/components/Workspace.tsx:366) · [Toasts.tsx](/home/frank/.cache/notesmith-review/r1/fixaudit2-copy/components/Toasts.tsx:19)

### 5. Responsive layout — partial

The toolbar uses the Living Document panel’s own width, and the phone header uses compact controls. [DocPanel.tsx](/home/frank/.cache/notesmith-review/r1/fixaudit2-copy/components/DocPanel.tsx:81) · [Workspace.tsx](/home/frank/.cache/notesmith-review/r1/fixaudit2-copy/components/Workspace.tsx:552)

- **MEDIUM — The sticky video can cover the workspace.** At 844 × 390, the video is about 466 px tall and the scroll area is 334 px tall. In a Chrome reproduction of the layout, scrolling the composer into view still left the video covering it and intercepting clicks. [Workspace.tsx](/home/frank/.cache/notesmith-review/r1/fixaudit2-copy/components/Workspace.tsx:593)

### 6. Rejected-key cue — partial

- **MEDIUM — A preference-only save now preserves unrelated errors and blocks auto-forge.** After a temporary network failure, turn auto-forge on and save without changing credentials. The retained error prevents the automatic retry. A manual retry still works. [Workspace.tsx](/home/frank/.cache/notesmith-review/r1/fixaudit2-copy/components/Workspace.tsx:329) · [settings save](/home/frank/.cache/notesmith-review/r1/fixaudit2-copy/components/Workspace.tsx:444)
- **MEDIUM — An in-flight request can restore the rejected-key cue after the key is corrected.** Start a forge with a bad key, save the replacement before the response arrives, and let the old request return 401. That response sets “Fix API key” and blocks auto-forge for the new key. [Workspace.tsx](/home/frank/.cache/notesmith-review/r1/fixaudit2-copy/components/Workspace.tsx:263) · [error handler](/home/frank/.cache/notesmith-review/r1/fixaudit2-copy/components/Workspace.tsx:300)

All 10 document tests passed in an isolated Node harness. Missing dependencies prevented the standard `npm test` run and full-app browser verification. I did not run the live model eval.