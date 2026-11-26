# NoteSmith design decisions

The values themselves live in `app/globals.css` (`:root`) and `tailwind.config.ts`. This file records the choices behind them, so they aren't re-argued.

## Look

- **The forge.** A warm, dark interface (charcoal neutrals, one ember-orange accent), because you use it next to a video and the blacksmith metaphor is literal: rough scribbles go in, finished notes come out.
- **Raw versus forged is visible in the type.** Scribbles are set in a monospace face (JetBrains Mono): raw material. Notes are set in a serif (Source Serif 4): finished work. Interface text is Inter. Topic headings and the wordmark use Pixelify Sans, to match the pixel smith.
- **The pixel smith** (`components/smith-sprite.ts`) is the app's character. He stands with his hammer raised when idle and hammers, with sparks, while notes are forging. He appears big on the start page and in the empty Living Document, and small in its corner while it updates.
- **Your words and the AI's are set apart.** A note's top line (your thought) is in the serif. Its detail sits under it in the interface face, muted, behind a rule, with a small label: FROM THE VIDEO or ANSWER in ember, ANSWER · GENERAL KNOWLEDGE in a fainter colour, because it isn't from the video.
- **Freshly forged notes glow** ember-orange for about 1.5 seconds and cool to normal. Embers drift up the Living Document while it forges.
- Fonts are bundled through `next/font`, so they look the same everywhere.

## Motion

Short fades of 120 ms (`--duration`) for interface changes. The only longer animations are the smith, the embers and the cooling glow, which are part of the metaphor. All of them stop under `prefers-reduced-motion`.

## Words

| Thing | Word | Not |
|---|---|---|
| A raw thought the user typed or spoke | scribble | note, entry |
| A refined thought in the document | note | bullet, item |
| The refined document | Living Document | summary, output |
| Running the AI | forge, forging, Forge now | generate, update, sync |
| Rebuilding all notes | Re-forge all | regenerate |
| Notes waiting | "N scribbles waiting" | pending, queued |

## Behaviour

- **Scribbles are the content; the video fills them in.** v1 replaced scribbles with paragraphs built around them; v2 only reworded them, which read like a copy. v3 (the current one) splits each note into two parts:
  - the **text** is the user's thought, made readable and self-contained: vague references ("they", "the models", a missing subject) are named from the transcript, and nothing else is added. Doubt ("??", "we'll see"), opinions, attribution, emphasis and numbers stay as written.
  - an optional **detail** under it (at most two sentences): *video* (what was said that the note refers to), *answer* (the video answers the user's question), or *general* (a general-knowledge answer when the video doesn't). Rules in `lib/refine/prompt.ts`.
- **Questions by kind.** A question asked to learn something is answered (from the video, else general knowledge, labeled). Doubt about a claim keeps the doubt and gets a neutral "from the video" line. Rhetorical or thinking-out-loud questions are never answered. Reminders ("look into X") stay to-dos.
- **Reactions** ("lol that", "wait what") keep the user's words; what they reacted to goes in a "from the video" detail, only when the moment makes it clear.
- **The whole transcript goes with every forge**, cached between forges, so notes can use what was said minutes earlier and answers can come from later in the video. A very long video is cut to a window around the scribbles.
- **Default model: Claude Sonnet 5.5.** In evals on a real user's scribbles it named subjects and kept host and guest apart clearly better than Haiku 5.5, for about three times the cost (roughly 50 cents for an hour of video).
- **Corrections** ("actually it was 2B not 20B") replace what they correct and end with "(Corrected from …)". Code guarantees no scribble is dropped (`lib/doc.ts`).
- **Notes stay put.** Only new or edited scribbles are sent. An existing note is rewritten only when one of its scribbles changes, or when a new scribble continues it.
- **Auto-forge** runs 4 seconds after the scribbles stop changing. It is on by default and can be turned off in Settings.
- A scribble is stamped with the video time at the moment you **start typing** it, not when you press Enter. Clicking a time chip jumps to **5 seconds before** that moment, because people write just after hearing something.
- Voice input pauses the video, and you resume it yourself.
- Deleting a scribble can be undone from the toast.
- Exports include the notes with time links, each detail as a labeled sub-bullet, and, below them, the raw scribbles.
