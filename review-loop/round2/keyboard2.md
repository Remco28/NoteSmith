I finished every step with the keyboard alone. The nearest thing to a blocker was a 4-Tab trip to the Undo button. Four findings need fixing.

I used `click` only to deal with the Undo toast and its timing. Everything else was `press`, `keys` and `focused`.

**1. Could I finish each step by keyboard?**
- **Start:** Typing the URL and pressing Enter took 1 press. Focus landed in the scribble box.
- **Scribbles and forging:** Enter added each scribble, and forging ran on its own. The notes came out grouped by topic. "this" got "(re: Palmer Luckey being just 33 years old)", marked as from the transcript.
- **Edit:** I tabbed to Edit and pressed Enter. The text became a field with the right name, and Enter saved it. Focus went back to that scribble's text button.
- **Delete and undo:** Delete worked by keyboard. The Undo toast was reachable only by tabbing. The count after a delete was:
  - Scribble box.
  - Voice-input button.
  - Panel resize handle.
  - Undo.

  Undo restored the scribble.
- **Transcript jump:** This was the worst step, about 25 presses. It took roughly 8 Tab presses to cross the YouTube iframe, then 1 to reach the transcript, then 14 ArrowDowns to reach 2:04. Enter jumped the video to 2:06 and focus stayed on the line.
- **Settings:** Reaching Settings from the transcript took about 10 Shift+Tab presses. Enter opened it, and Escape closed it.
- **Copy:** Copy worked. The clipboard held valid Markdown with the heading, the note with its timestamp link, and the raw scribbles. A toast said "Copied the notes as Markdown".

**2. Is focus visible, and does it go somewhere sensible?**
- The orange focus ring was visible everywhere I checked: the scribble text, Copy, the Settings close button and the NoteSmith logo.
- After a delete, focus drops to the page body, so the next Tab restarts from the top of the scribble list. This happened after both the delete and the undo.
- Settings is not a focus trap. Tab from Save went to the page body and then behind the dialog. It should wrap back to the close button.

**3. Accessible names**
- **Delete and Edit buttons:** Every delete button is just "Delete scribble" and every edit button is "Edit scribble". Nothing says which scribble. The scribble text button is named correctly, as "Edit scribble: this".
- **Settings fields:** The focus report showed the API key field, the model field and both checkboxes as unnamed inputs. I didn't read the dialog's accessibility tree, so I'm not sure this is a real gap. It is worth checking.
- **Undo button:** It had no `title`, and the toast was never in the tree output I could read, because that output cuts off at the long transcript.
- **Skipped when disabled:** Forge now and Follow video are skipped while disabled, which is fine.
- **Other names:** Settings, Copy, Download, Re-forge, Close settings and the transcript lines are all named clearly. The transcript lines each include the timestamp.

**4. Other things I'm sure of**
- The Undo toast disappears after a few seconds, with no way to hold it. A keyboard user needs 4 Tabs to reach it, so they can lose it.
- The YouTube iframe adds about 5 to 8 extra Tab stops every time you cross it.
- Jumping the video to 2:00 left the scribble box timestamp at 2:51 later, which is correct. All my scribbles were stamped 0:00 because the video wasn't playing when I wrote them.
- Beyond the above, the forged notes kept my wording, added no facts, and left the question as a question.

**Not checked**
- The transcript-reference setting turned off.
- Download.
- Voice input.
