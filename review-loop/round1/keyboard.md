I finished every step with the keyboard alone. There were a few focus problems and one very long Tab route. I didn't test whether Tab is trapped inside the Settings dialog. I couldn't confirm the dialog's role or accessible name, because the `tree` output was cut off before the dialog.

**One command was blocked.** My first command used a shell variable, and the session auto-denied it. I reran everything with the full path and had no further trouble.

## 1. Could I finish each step by keyboard?
- **Start a session:** yes. The link field has focus on load, so I typed the link and pressed Enter.
- **Add three scribbles:** yes, but not at first. After starting, focus fell to the body, and the scribble box wasn't focused. I reached it with 4 Shift+Tab presses from the first Tab stop. After each Enter, focus stayed in the box, which is good.
- **Get them forged:** yes. Forging ran automatically and no key press was needed.
- **Edit a scribble:** yes. Each scribble is a button (title "Click to edit"), and Enter opens an "Edit scribble" textarea.
- **Open and close Settings:** yes. The worst step was reaching the Settings button, which took about 13 Tab presses (11 after the edit, plus 2 more to reach the Copy button).
- **Copy the notes:** yes, with "Copy as Markdown" and Enter. The clipboard held correct Markdown, and a "Copied the notes as Markdown" message appeared.

**The worst step is getting to the header or to the scribble box from the top of the page.** The Transcript panel puts about 80 line buttons in the Tab order, with no skip link. Going from the transcript to the scribble box or back to the header means pressing Tab or Shift+Tab dozens of times. I got around it because focus was already near the bottom.

## 2. Focus visibility and where focus goes
- Focus is visible everywhere I looked: an orange ring on the scribble box, the Copy button, the Close button and the panel divider.
- **Broken:** after starting a session, focus drops to the body and nothing is focused.
- **Broken:** after saving a scribble edit with Enter, focus drops to the body again. The next Tab continued from where the edited row had been, not from a sensible place.
- **Good:** closing Settings with Escape returns focus to the Settings button.
- **Good:** opening Settings puts focus on "Close settings".
- **Minor:** the Tab order is odd. A nameless focusable `div` (the panel divider) turns up twice, in the middle of the sequence. I reached the Copy button through a separator that has no name.

## 3. Accessible names
- The named controls are fine: "Settings", "Change video", "New scribble", "Edit scribble", "Delete scribble", "Start voice input", "Re-forge everything from scratch", "Copy as Markdown" and "Close settings".
- **Wrong or unclear:**
  - The panel divider is a focusable `div` with no role or name in `focused`.
  - Every scribble's timestamp button is just "0:00" (title "Jump to 0:00"), so a screen reader can't tell which scribble it belongs to. The living-document timestamps are the same.
  - The scribble text buttons carry only the scribble text. "Click to edit" is a tooltip, not part of the name.

## 4. Contrast and target sizes
- **Contrast:** several texts are noticeably faint on the dark background. This is from the screenshots only, with no measured ratios.
  - The placeholder "Raw material goes here…" and the hint "Type a thought and press Enter…".
  - The transcript timestamps.
  - The disabled "Follow video" and "Forge now" buttons.
  - The small "3 scribbles" counter.
- **Target sizes:** the delete (trash) icons and the mic and enter icons in the scribble box are about 16 to 20 px. The timestamp chips are also small.
- **Other:** all three scribbles were stamped 0:00 because the video was paused. That isn't a bug.
- **Forge quality:** the first forge grouped everything under "Defense tech", and the later pass moved the preparedness note to "Emergency prep". The meaning and the doubts stayed the same.

I found no other broken behaviour.
