**I would not sign off on stopping yet.** The two-round budget supports stopping the *reader loop*, but the ledger does not establish that all verified HIGH and MEDIUM findings have been fixed. In particular, it dismisses two observed changes to the writer’s meaning and gives an unsupported reason for dismissing persisted notes with embedded context.

The evidence is in the [round-2 ledger](/home/frank/.cache/notesmith-review/r1/audit2/LEDGER.md), the [faithfulness report](/home/frank/.cache/notesmith-review/r1/audit2/reports/faithful2.md), the [fix audit](/home/frank/.cache/notesmith-review/r1/audit2/reports/fix-auditor.md), and the [post-fix prompt](/home/frank/.cache/notesmith-review/r1/audit2/prompt-at-25a0c82.ts). I also checked the relevant commits and storage code. I did not run new model or browser reproductions.

## Dispositions that do not hold

- **Row 17 — “andrew” → “Anduril”: reject the decline; verified HIGH.** Correcting a misspelling can be legitimate, and Frank’s example supports that job. But “andrew” and “Anduril” are different names; the reported transcript also says “Andrew.” The result substitutes a company for the writer’s word and treats the inference as certain. That is an observed change of meaning under the ledger’s own stakes, not merely a preference about spelling. The current prompt still explicitly permits fixing garbled names and says captions may be wrong. It needs a way to preserve ambiguous names or uncertainty, plus a check of this case. The precise source of the model’s guess is not established, but the substitution is.

- **Row 18 — “oculus 2b at 21” → “Oculus sold for 2b at 21”: reject tier 3; verified HIGH.** “Sold” supplies the transaction, not just grammatical glue. The fragment does not itself say whether 2b was a sale price, valuation, investment, or something else. This is an added factual claim, directly contrary to rule 2. The prompt permits connecting words only when they add no information; that instruction does not show this observed failure is fixed. The ledger’s statement that the reader saw “no added facts” is therefore incorrect.

- **Row 23 — old embedded context: the stated rejection is unsupported.** The reviewed original commit `cce484f` and the later app both use the `notesmith:` storage prefix and session keys. The original prompt could put transcript guesses directly into note text, and the fix auditor found those notes survive ordinary forging and ignore the switch. A different storage key in an even older app does not establish that no real user has a `cce484f` session. Whether anyone actually has such a session is an exposure question, not answered by the ledger. Treat this as a verified compatibility defect, at least MEDIUM when existing sessions are in scope; establish exposure and fix migration or provide a reliable way to regenerate affected notes.

- **Row 21 — iframe Tab stops: the decline gives a cause, not a kill attempt.** The keyboard reader measured roughly 5–8 extra stops. YouTube owns the controls, but NoteSmith embeds them and the cost is borne by its users. Assess practical ways to bypass the player while retaining access to its controls; then fix or decline a verified LOW with a reason. I would not claim a particular remedy is feasible without checking.

- **Row 19 — dialog focus: the mechanism is credible, but the observed conflict remains unresolved.** Native `showModal()` makes the rest of the document inert, and reaching browser chrome can be normal. The reader nevertheless reported focus going *behind the dialog*. The report does not establish whether that was browser chrome or an actual background element. A short keyboard reproduction should distinguish them before closing it; this is not yet a verified defect.

The remaining disputed dispositions are more defensible. **Row 20** is a justified tier-0 rejection: the reader was unsure, the inspection tool reported only `aria-label`, and the inputs have associated labels. **Row 22** is a real, reproduced roughly five-second interruption, but a LOW decline is reasonable given the recorded desktop usage and resizing trigger. **Row 24** has a concrete contrast calculation answering the reported concern, subject to those being the actual rendered color pairs. **Row 25** is taste for Frank.

## Severity, omissions, and fix evidence

**Row 7 should be HIGH, not MEDIUM.** Dropping “got fired” and inventing “Corrected from 90b paid” both change the content of notes, the exact loss/distortion category the ledger calls HIGH. The prompt was changed and “got fired” was correct in two runs, but the ledger does not show that the invented parenthetical and orphaned “Same.” were separately retested. Two successful stochastic runs are useful evidence for the particular case, not evidence that the whole row is resolved.

The post-fix record also needs a narrower claim for **row 1**. Verifying that an aside is a real quote does not verify that it is the phrase a reaction referred to; the author recognizes that. Moreover, “off by default” applies to new or missing settings. A user who saved settings while round 1 defaulted the switch on can retain `showContext: true`, and existing wrong asides can persist. Check the upgrade path and decide how to handle already-saved asides. This is separate from row 23’s older context embedded in note text.

The faithful reader also reports a statement made into a question. That example—“or is it the other guy, not sure”—already has interrogative wording, so adding `?` is not clearly a meaning change. It should be recorded as considered, not promoted automatically to a verified HIGH.

The main eval reported after round 2 was an **earlier run on an allegedly unchanged code path**, not a demonstrated post-fix end-to-end run; the correction evidence covers two runs. The reader sample also did not rerun first-time or returning personas, and the student did not complete the requested video range. These limitations do not by themselves mandate another full round, but they make the broad claim that the fixes are clean too strong.

## “From” labels

Most fix-related labels have a plausible causal basis: the separate context field and recent excerpt, transcript tab behavior, panel-width labels, correction-specific rule, timestamp announcements, key cue, and list role were introduced or changed in round 1. The original prompt already permitted name correction and small connecting words, so rows **17 and 18 trace to `cce484f`**, not to the round-1 fix.

There is at least one material overstatement:

- **Row 11 is mixed origin.** Round 1 introduced the generic pencil-button name, but the generic **Delete scribble** name already existed at `cce484f`. Label it `cce484f / from a fix in round 1`, as with other mixed rows.
- **Row 23 traces to the original prompt and persisted original notes**, exposed by the new context switch. It should not be left without an origin.
- **Row 7’s new correction rule is a credible contributor**, but the broader possibility that a model merge drops content existed before it. “From a fix” is justified for the new correction-specific behavior, not proof that every loss mechanism originated there.
- **Row 5’s mixed label is appropriate**: the base header existed already, while the new key cue worsened one case.

Thus “11 of 16 came from round-1 fixes” should be qualified for mixed-origin rows; it is not a clean count of wholly new defects.

## Decision

Before declaring the review complete, address and check the observed **name substitution**, **invented sale**, and **correction loss/invention**; resolve the **persisted embedded-context** exposure and handling; and check the upgrade behavior for saved context settings and asides. These are targeted follow-ups within the existing review findings, not necessarily a third reader round. The iframe and dialog findings also need the stated kill attempts or a reasoned LOW disposition.