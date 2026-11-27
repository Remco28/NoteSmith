# Review-loop ledger: NoteSmith (rebuilt app, branch refine-notes)
*Kept by the review-loop skill. Safe to delete this folder once the work is done.*

Success question: Can someone who thinks while watching a long video scribble rough thoughts in NoteSmith, starting cold and without guessing, and end up with notes that keep what they meant (nothing added, nothing lost) and that they would trust and export?

Rules confirmed with: Frank, in the session of 2026-11-25 ("refining the scribbles … instead of replacing it with related topics"; "anyone … provide their own API key and specify which model"; "you're right on the mark"):
1. Each note is the user's scribble, refined: same meaning, cleaner wording.
2. Nothing is added that the user didn't write: no facts, no summary, no answers to their questions.
3. Nothing is dropped: every scribble appears in a note.
4. Questions stay questions; doubt stays doubt.
5. Notes are grouped by topic, and each links back to its moment in the video.
6. Each user brings their own API key and chooses a model; the default is Anthropic `claude-haiku-5-5`.

Reviewing: a whole thing (the app as of commit cce484f; production build), so findings carry *untraced*, a commit, or *from a fix in round n*.

Stakes (drafted by the author; Frank delegated judgment and has little time): personal tool, used by Frank and possibly a few others running it locally. A failure costs lost or distorted notes (high: it is the product's one promise), a confusing first run (medium), or polish (low). No money moves; keys stay in the browser. Budget: at most two rounds of about six readers, one check-in not needed (fewer than three rounds).

How it is really used: Frank runs `npm run dev` locally with his own Anthropic key in `.env.local`; Chrome on a Linux desktop around 1440 wide; English videos with auto-captions. Others would run it locally or on a host with their own key in Settings.

Step 0 (checks run before readers): `npm test` (8 pass), `npm run eval` (latest: 20 notes from 20 scribbles, judge good 15 to 17, bad 0), lint clean, production build passes, two scripted browser walkthroughs (all flows worked; export matched).

Deviation from readers.md, recorded: readers.md's running-code recipe cuts the network, so a reader could not reach the app's model or YouTube. Instead the author runs the app (ports 3123 with server key, 3124 without) and one browser per reader outside the fence; inside the standard fence a Claude reader may run only `<round>/browse-<reader>` (a client that sends one browser command to its own browser). The reader has no other shell, no code and no repository access beyond read-only.

## Round 1, 2026-11-25, cce484f (production build)
Predictions (written before the round):
- Per round: 8 to 15 verified findings. Most in keyboard/accessibility (Tab through ~150 transcript rows before reaching the scribble box; delete buttons faint until hover), phone layout (fixed panel heights), and first-run guidance. One likely verified rule break: the copied Markdown includes a "Raw scribbles" section that the screen doesn't show ("what leaves the app matches the screen"). Topic grouping will draw tier-3 taste comments. The faithful adversary will find 1 to 3 notes that add a few words of context to pointing-word scribbles, and possibly translate a non-English scribble.
Cast: six Claude readers (claude-sonnet-5-5, the models skill's row for using the app in a browser):
- thinker: main path, persona who thinks while watching (app with server key)
- firsttime: cold start with no key, fake key (app without server key)
- returning: seeded session of 7 scribbles; edit, delete, undo, re-forge, export
- faithful: adversary for rules 1 to 4
- polish: visual polish and trust specialist, three sizes
- keyboard: accessibility specialist, keyboard only

### Round 1 results (reports in `round1/`)
All six exited 0 within 30 min. The repository was unchanged after the round. Each reader had one command denied (a shell variable in the path), then used literal paths. Not a finding.

| # | Finding | Reader (their rating) | Ours | From | How checked | Done |
|---|---|---|---|---|---|---|
| 1 | Pointing-word scribbles ("lol that", "this", "wait what") get a transcript guess written as the user's own words; "this" resolved to the wrong thing | faithful (very sure) | Tier 1, HIGH: breaks rule 2, the core promise | cce484f (prompt allowed it) | Reproduced: `eval/tricky.json`, judge "bad" ×2, different wrong referent than the reader got | Fix: context goes in a separate, visibly marked `context` field from only the last ~20 s; note text keeps the user's words |
| 2 | A correction scribble merged with the claim it corrects keeps both, so the note contradicts itself | faithful (very sure) | Tier 1, HIGH | cce484f | Reproduced in `eval/tricky.json` | Fix: prompt says a correction replaces the corrected claim and says what changed |
| 3 | Small additions: "$" before 9k, "sold to Facebook", "?" added to a statement ("bc nimby" → "NIMBY?"), "??" softened to "?", emphasis "IS" lost | thinker, faithful, returning (minor) | Tier 1, MEDIUM | cce484f | Reproduced ("$9k", "NIMBY?") | Fix: prompt keeps the writer's doubt punctuation and emphasis; no added units or currency |
| 4 | Topics: catch-all groups after re-forge ("AI infrastructure" holding unrelated notes, "Tech and defense") | returning (broken), faithful (taste), thinker (minor) | Tier 1, MEDIUM | cce484f: `topicLimit` = n/3.5 forces 7 notes into ≤2 topics | Read the code: 7 notes → limit 2 | Fix: limit max(3, n/2.5); never force a note into an unrelated topic |
| 5 | Faint text (hints, transcript times, counts) too low in contrast | keyboard, polish (taste) | Tier 1, MEDIUM | cce484f | Computed: `--faint` is 3.1 to 3.7:1, below 4.5:1 | Fix: lighten `--faint` |
| 6 | ~80 transcript rows are Tab stops; no way past them | keyboard | Tier 1, MEDIUM | cce484f | Read the code: every row is a button | Fix: one Tab stop for the transcript (current line), arrow keys move |
| 7 | Focus drops to the page after opening a video, and after saving an edit | keyboard | Tier 2 → tier 1 (code has no focus handling there) | cce484f | Read the code | Fix: focus the composer on open; refocus the row after edit |
| 8 | Resize handle focusable with no name; time chips named only "0:00" | keyboard | Tier 1, LOW | cce484f | Read the code | Fix: aria-labels |
| 9 | Toast straddles the gap between the two lower panels | polish | Tier 1, LOW | cce484f | Screenshot `toast-1440.png` | Fix: bottom-right |
| 10 | After a bad key is saved, the header's key button disappears; the only cue is the banner | firsttime | Tier 2 → 1, LOW | cce484f | Read the code: button shows only when no key | Fix: header shows "Fix API key" while the key is rejected |
| 11 | Phone 390: Living Document header wraps and is cramped; notes start at the bottom | polish | Tier 1, LOW (a setup not in use) | cce484f | Screenshot `ws-390.png`. The column does scroll; the reader scrolled `main`, which doesn't | Fix: compact header on narrow; doc before scribbles get taller share |
| 12 | Start button disabled with no explanation | thinker, firsttime | Tier 1, LOW | cce484f | Two readers | Fix: keep enabled; empty link shows an error |
| 13 | Empty state and placeholder both say "Raw material goes here." | polish (taste) | Tier 1, LOW | cce484f | Screenshot | Fix: placeholder "Type a thought…" |
| 14 | Forge now gives weak feedback while forging | polish (taste) | Tier 3 → small fix | | | Fix: button reads "Forging…" while working |
| 15 | Key: who it's sent to, how to remove it | firsttime | Tier 1, LOW | cce484f | Read Settings copy | Fix: copy says "to Anthropic/OpenAI through this NoteSmith server; clear the field to remove it" |
| 16 | Export has a "Raw scribbles" section not in the Living Document | (predicted); thinker and returning liked it | Declined | | | Declined: the raw scribbles are on screen in their own panel; the section is labelled; readers found it useful |
| 17 | Video black after resizing across the narrow breakpoint | polish (unsure) | Declined, LOW, a setup not in use | | Player remounts when the layout switches; loads again after a moment | Declined |
| 18 | Small targets (trash, mic, enter icons) | keyboard | Declined | | Buttons are 28 to 32 px; the icons inside are 14 to 16 | Declined |
| 19 | Timestamps drift from the transcript line clicked | thinker, faithful | Tier 0 | | The driver's `fill` enters text at once, so "time you started typing" equals submit time | Rejected: an artefact of how readers typed |
| 20 | Icon-only Living Document buttons (re-forge, copy, download) | returning | Tier 3 | | Accessible names exist (keyboard reader read them) | For Frank |
| 21 | Transcript panel small; wants "jump to time" | thinker | Tier 3 | | | For Frank |
| 22 | Intro ends on a one-word line | polish (taste) | Tier 3 → trivial fix | | | Fix: balanced wrapping |

What happened against the predictions: findings 14 verified (predicted 8 to 15). Keyboard Tab-through-transcript: predicted, verified. Faint delete buttons: not raised as such. Export "Raw scribbles" mismatch: predicted as a verified rule break; readers liked it, declined. Adversary: predicted 1 to 3 added-context notes; found 3 plus a correction merge I did not predict. Non-English scribble: predicted translation; it was kept as written.
Believed, and wrong: "If a scribble is too terse to understand on its own ('lol', 'this'), add a few words from the transcript" (my prompt) was believed safe; the guesses pick the wrong referent and read as the user's words. Also believed "a numeric topic limit fixes topics"; at n/3.5 it caused the catch-all groups.

### Disposition audit, round 1 (Codex gpt-6.1-terra, `round1/disposition-auditor.md`)
Accepted, and acted on:
- Row 3 is HIGH, not MEDIUM: turning a statement into a question changes meaning. Already fixed.
- Row 19 is not tier 0. People react after hearing, so a stamp at "started typing" still trails the moment. Now tier 1, LOW. Fix: jump links (time chips) rewind 5 s. The stamp itself stays "when you started typing".
- Row 20 is not answered by accessible names. Fix: visible labels on Re-forge, Copy and Download at wide sizes, and a visible edit (pencil) button on each scribble.
- Missed findings, now fixed in the prompt: "he says" attribution dropped (faithful); a topic introduced "Huang", which no scribble contained (thinker).
- Row 18: time chips were 20 px, under the 24 px target minimum. Now 24 px.
- Row 7 severity: MEDIUM. Both transitions were verified in the running app after the fix.
- Row 17: needs a reproduction, not a decline. Still open, LOW, a setup not in use.
Decision for Frank: whether to show the transcript context for pointing scribbles at all. The auditor argues it adds something the user didn't write. The author chose to show it, marked "(re: …)", with a Settings switch that defaults to on. This is on the human page.
Contested, for Frank: a flat correction ("actually it was 2B") drops the earlier "right?" and "I think". The eval judge rates this bad; the author's rule says the correction settles the doubt, and the note keeps "(Corrected from …)".

Round 1 fixes: commit 2087c0e. Evals after the fixes: main 18 good / 2 minor / 0 bad, 7 topics; tricky 7 / 2 / 1 (the contested correction). Tests 9 pass; lint clean.

## Round 2, 2026-11-25, 2087c0e (production build)
Predictions (written before the round):
- Per fix: the faithful reader should now see "lol that" kept as the user's words, with a marked (re: …) aside; a correction should read once with "(Corrected from …)"; "??" should survive. The keyboard reader should reach the scribble box with no presses after opening a video, and should get past the transcript in one Tab. The polish reader should no longer report the toast, the start button, or contrast.
- Per round: 2 to 6 verified findings, mostly LOW, none HIGH. The most likely new one is a fault from the fixes: the transcript's arrow-key navigation or the pencil button's interaction with editing. The faithful reader will probably still find 1 or 2 small additions (connecting words judged as content) and will debate the context asides.
Cast: fix auditor (Codex gpt-6.2-sol, code review of the round-1 diff); four Claude readers (claude-sonnet-5-5) with new personas: student (main path), faithful2 (adversary), keyboard2, polish2. Retired: none yet. firsttime and returning are not rerun; their fixes are small and were verified by the author in the app.

### Round 2 results (reports in `round2/`)
All exited 0. The repository changed only in the author's own doc edits to README.md and docs/DESIGN.md, made during the round. Every reader again had its first shell-variable command denied.

| # | Finding | Reader (their rating) | Ours | From | How checked | Done |
|---|---|---|---|---|---|---|
| 1 | "(re: …)" asides point at the wrong moment or paraphrase loosely ("lol thermostats" at 14:32; "this" at 1:19 got the bank line; "Industry advisers…" paraphrase) | student, faithful2 (certain); polish2 (paraphrase) | Tier 1, MEDIUM | from a fix in round 1 | Reproduced in the tricky eval | Fixed: verbatim quotes only, checked in code against the 15 s before (`verifyContext`, unit-tested); pointing-only scribbles; **off by default**. After the fix, quotes are always real words, but which phrase a "lol" reacted to is still a guess, which the judge disputes, so it stays opt-in |
| 2 | `recent` excerpt included 3 s after the scribble | fix auditor (MEDIUM) | Tier 1, MEDIUM | from a fix in round 1 | Read the code | Fixed: 0 s after |
| 3 | Merge kept a stale aside | fix auditor (MEDIUM) | Tier 1, MEDIUM | from a fix in round 1 | Read the code | Fixed |
| 4 | Transcript gains a second Tab stop as playback advances | fix auditor (MEDIUM, reproduced) | Tier 1, MEDIUM | from a fix in round 1 | Reproduced after the fix by script: the tab stop stays on the focused row | Fixed |
| 5 | Workspace header overflows at 320 to 375 px | fix auditor (MEDIUM) | Tier 1, LOW (a setup not in use) | cce484f / from a fix in round 1 | Script: no overflow at 375 after the fix | Fixed |
| 6 | Toolbar labels clip when the panel is narrow at 1280 | fix auditor (MEDIUM) | Tier 1, LOW | from a fix in round 1 | Read the code (viewport breakpoint) | Fixed: labels follow the panel's own width |
| 7 | Corrected note drops other content ("got fired") / orphaned "Same." / invented "(Corrected from 90b paid.)" | faithful2; tricky eval | Tier 1, MEDIUM | from a fix in round 1 (correction rule) | Reproduced ("got fired" dropped) | Fixed: "everything else the original said stays"; 2 of 2 runs correct |
| 8 | CAPITALS emphasis kept inconsistently | faithful2 (certain) | Tier 2 → 1, LOW | cce484f | One reader plus the prompt's single example | Fixed: rule names CAPITALS → italics |
| 9 | Focus drops to the page after a delete, or after clearing a scribble | keyboard2, fix auditor | Tier 1, LOW | cce484f / from a fix | Script: focus goes to the scribble box | Fixed |
| 10 | Undo is hard to reach by keyboard before the toast vanishes | keyboard2 | Tier 2 → 1, LOW | cce484f | Read the code (7 s, Tab only) | Fixed: Ctrl+Z, 10 s; script-verified |
| 11 | Delete and Edit buttons don't say which scribble | keyboard2 | Tier 1, LOW | from a fix in round 1 | Read the code | Fixed |
| 12 | Chip labels say "Jump to 0:30" but seek to 0:25 | fix auditor (LOW) | Tier 1, LOW | from a fix in round 1 | Read the code | Fixed: "just before" |
| 13 | Saving an unrelated setting clears the "Fix API key" cue | fix auditor (LOW) | Tier 1, LOW | from a fix in round 1 | Read the code | Fixed |
| 14 | `role="list"` with no list items | fix auditor (LOW) | Tier 1, LOW | from a fix in round 1 | Read the code | Fixed: `role="group"` |
| 15 | Prompt examples contradict its rules (5ml → "about 5 ml"; Tim Cook → Apple) | fix auditor (LOW) | Tier 1, LOW | cce484f | Read the prompt | Fixed |
| 16 | Phone: video scrolls away; scribble hint and key placeholder cut off | polish2 | Tier 1, LOW (a setup not in use) | cce484f | Screenshots | Fixed: sticky video, shorter texts |
| 17 | "andrew" corrected to "Anduril" using outside knowledge | faithful2 (near certain) | Declined | | | Declined: fixing misheard names is a stated job of the refiner (rule 1, "cleaner wording"; Frank's own "openclaw?" example). For Frank as tier 3 |
| 18 | "Oculus sold for 2b": "sold" added | faithful2 | Tier 3, LOW | | | A connecting word; for Frank |
| 19 | Settings is not a focus trap (Tab leaves to the page) | keyboard2 | Declined | | Native `<dialog>` with `showModal()` makes the page inert; Tab can reach the browser's own UI, which is standard | Declined |
| 20 | Settings inputs unnamed | keyboard2 (unsure) | Tier 0 | | The driver's `focused` prints only aria-label; the inputs have `<label for>` | Rejected |
| 21 | YouTube iframe adds Tab stops | keyboard2 | Declined | | The embed's own controls | Declined |
| 22 | Black video for ~5 s after a resize | polish2 (taste) | Round-1 row 17 resolved | | polish2 saw it recover after ~5 s | Declined: transient; a setup not in use |
| 23 | Old notes with embedded context ignore the switch | fix auditor (MEDIUM) | Declined | | Such notes exist only in this review's test browsers: the old app used a different storage key, so no real session has them | Declined |
| 24 | Error text and aside contrast | polish2 (taste) | Declined | | `--danger` on canvas is 5.1:1 (computed); the aside uses `--muted` at 6.3:1 | Declined |
| 25 | Settings checkbox labels a few px apart | polish2 (taste) | Tier 3 | | | For Frank |

Evals after the round-2 fixes: main 18 good / 2 minor / 0 bad (earlier run, unchanged code path); tricky: the corrections are right on 2 of 2 runs. The judge still disputes "This." left bare (by design) and one topic placement.
What happened against the predictions: verified 16 (predicted 2 to 6). Wrong about the count, because the fix auditor read the code and found more than readers do. Right that none were HIGH and that most came from round-1 fixes (11 of 16). Right that the faithful reader would debate the asides; wrong that the faithful reader's notes would be clean: there were no added facts, but the correction merge still had faults.
Believed, and wrong: "a separate, marked context field taken from the last 20 s" would make the asides reliable. Quoting is reliable; choosing what a "lol" reacted to is not, so the feature is opt-in.

Round 2 fixes: commit 25a0c82.

### Audits after round 2 (`round2/fix-auditor-2.md`, `round2/disposition-auditor.md`)
Fix auditor (Codex gpt-6.2-sol) on 25a0c82: 1 HIGH and 7 MEDIUM, all from a fix in round 2 except the undo snapshot, which dates from cce484f (the toast) and was made worse by round 2's Ctrl+Z.
Disposition auditor (Codex gpt-6.1-terra): would not sign off on stopping. Accepted, and acted on:
- Row 17 ("andrew" → "Anduril") is a verified HIGH: it substitutes a guess for the writer's word. From cce484f. Fixed: the writer's word stays, with a marked guess, "Andrew (Anduril?)". Checked in the extended tricky eval.
- Row 18 ("sold" added) is a verified HIGH: it adds a fact. From cce484f. Fixed: no words that say what happened. "Oculus, 2b at 21." Checked in the eval.
- Row 7 is HIGH. The invented bracket and the stray "Same." were retested in the eval: the bracket now names only what was written.
- Row 23 decline withdrawn. Sessions and settings are now versioned: older notes are rebuilt from the scribbles, and the aside setting resets to off.
- Row 19 (dialog focus): kill attempt done. Scripted Tab ×12 from Settings stays in the dialog or reaches the browser's own UI, never a page element. Declined.
- Row 21 (iframe Tab stops): kill attempt. Removing the player from the Tab order (`tabindex=-1`) would leave keyboard users no way to play or pause, because NoteSmith has no player controls of its own. Declined, LOW, with that reason.
- Row 11's origin is mixed: cce484f / from a fix in round 1.
- "11 of 16 from round-1 fixes" overstated it; several rows are of mixed origin.
Fix auditor's items, all fixed in 3c4dab8: undo now merges into the current state (script: delete A, add C, Ctrl+Z → A, B, C); an older toast no longer disables a newer Ctrl+Z; whole-word quote match and reaction-only asides in code (unit tests); a strict 15 s caption window; a stale 401 is ignored; preference saves clear unrelated errors; the landscape video is capped (script: 156 of 390 px); the "very hard" example now keeps "very".
Evals after 3c4dab8, run fresh: main 18 good / 2 minor / 0 bad, 7 topics, no earlier note rewritten; tricky (15 scribbles) 7 / 4 / 2, both "bad" being the contested correction-doubt rule and an aside on "lol that" (now opt-in). Tests 10 pass. Lint clean. Build passes.
Final fix auditor on 3c4dab8 (`round2/fix-auditor-3.md`): the HIGH undo bug is confirmed fixed. It found 4 MEDIUM and 3 LOW, all rare-timing or model-misbehaviour edge cases: undo during an in-flight forge, interleaved deletes then undo, a settings change mid-batch, a reaction scribble listed in two items, contractions in quote matching, correction brackets across batches, and Ctrl+Z from the composer. All are fixed in 961ba66. Unit tests cover the quote checks. A script checked Ctrl+Z from the empty composer, and interleaved deletes then undo with no duplicate notes. Evals: main 17 / 3 / 0; tricky 8 / 2 / 3 (the contested correction-doubt rule, the opt-in aside, and one correction merge that dropped a stray "and same" this run). Correction merges are the least stable area; noted for Frank.

## Stop
Stopped after round 2 plus targeted follow-ups. Reasons: the agreed budget was two rounds; the direction test converges (round 2's last audit found only rare-timing edge cases, and its one HIGH, from round 2's Ctrl+Z, is fixed and re-verified); every verified HIGH and MEDIUM is fixed; what remains is tier 3 or a decision for Frank. The fixes in 961ba66 were checked by tests and scripts, not by another auditor. That is a limit of this review.
Decisions for Frank (on `report.html`): the context aside (off by default; keep, or remove); correction doubt (drop "right?" after a flat correction); marked name guesses ("Andrew (Anduril?)").

## Mistakes the next author will make
- Changing the prompt without running both `npm run eval` and `npm run eval -- eval/tricky.json`. The tricky set holds every failure testers found, and the main set alone looks fine when the hard cases regress.
- Trusting the eval judge on the rules Frank chose. It repeatedly flags "This." left bare and doubt dropped after a correction; both are deliberate here.
- Letting the model "helpfully" resolve context, names or connecting verbs. Every such allowance in the prompt produced added content within a round (pointing words, "sold", "Anduril").
- Restoring snapshots for undo. Put back only what the action removed, on top of the current state.
- Killing a dev server through its `npx` wrapper: the child `next-server` keeps running and writes into `.next`, which corrupts a production build made at the same time.

