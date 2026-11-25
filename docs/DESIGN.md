# NoteSmith design decisions

The values themselves live in `app/globals.css` (`:root`) and `tailwind.config.ts`. This file records the choices behind them, so they aren't re-argued.

## Look

- **The forge.** A warm, dark interface (charcoal neutrals, one ember-orange accent), because you use it next to a video and the blacksmith metaphor is literal: rough scribbles go in, finished notes come out.
- **Raw versus forged is visible in the type.** Scribbles are set in a monospace face (JetBrains Mono): raw material. Notes are set in a serif (Source Serif 4): finished work. Interface text is Inter. Topic headings and the wordmark use Pixelify Sans, to match the pixel smith.
- **The pixel smith** (`components/smith-sprite.ts`) is the app's character. He stands with his hammer raised when idle and hammers, with sparks, while notes are forging. He appears big on the start page and in the empty Living Document, and small in its corner while it updates.
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

- **Scribbles are the content.** The AI rewrites wording only. It never answers questions or adds facts (see `lib/refine/prompt.ts`), and code guarantees no scribble is dropped (`lib/doc.ts`).
- **Notes stay put.** Only new or edited scribbles are sent. An existing note is rewritten only when one of its scribbles changes, or when a new scribble continues it.
- **Auto-forge** runs 4 seconds after the scribbles stop changing. It is on by default and can be turned off in Settings.
- A scribble is stamped with the video time at the moment you **start typing** it, not when you press Enter.
- Voice input pauses the video, and you resume it yourself.
- Deleting a scribble can be undone from the toast.
- Exports include the notes with time links and, below them, the raw scribbles.
