# NoteSmith

Scribble while you watch a YouTube video. NoteSmith forges your rough scribbles into clean notes: it keeps what you meant, fixes the wording and names, and groups the notes by topic. It adds nothing you didn't write.

- **Raw Scribbles:** type or speak a thought. It's stamped with the moment in the video.
- **Living Document:** each scribble becomes a refined note, grouped under topics, with a link back to its moment. Notes update a few seconds after you stop adding scribbles.
- **Transcript:** follows the video. Click any line to jump there.
- **Export:** copy or download the notes as Markdown, with the raw scribbles below.

It is not a summarizer. The model is told to treat each scribble as the content and the transcript as background only. It never answers your questions, and code (not the prompt) guarantees that no scribble is ever dropped.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Open the app, paste a YouTube link, and add your API key in **Settings** (the gear icon).

## API keys and models

Each person uses their own key:

- **Provider:** Anthropic (default) or OpenAI.
- **Model:** any model id. The default is `claude-haiku-5-5`, which is fast and costs a fraction of a cent per update.
- The key is kept only in the browser's local storage and sent with each forge request. The server uses it for that request and never stores or logs it.

**A key on the server (optional).** Put `ANTHROPIC_API_KEY` and/or `OPENAI_API_KEY` in `.env.local` and the app works without entering a key in the browser. For safety, the server's key is used **only for requests to localhost**. On a public deployment it's ignored, unless you set `NOTESMITH_SHARE_SERVER_KEY=true`, which lets anyone with the URL spend your credits. See `.env.example`.

## Where things are

| Path | What |
|---|---|
| `lib/doc.ts` | The rules that keep scribbles safe: what needs refining, applying the model's answer, ordering, Markdown export |
| `lib/refine/prompt.ts` | The refining prompt and the JSON schema the model must answer in |
| `lib/refine/run.ts` | Calls the model, checks the answer, retries anything it left out |
| `lib/llm/` | Anthropic and OpenAI adapters |
| `app/api/refine` | `POST`: refines a batch of scribbles |
| `app/api/transcript` | `GET`: captions (English first) and the video title |
| `components/Workspace.tsx` | App state, forging loop, layout |
| `components/smith-sprite.ts` | The pixel blacksmith |
| `docs/DESIGN.md` | Design decisions and the words the app uses |
| `docs/history/` | The original v1 plan and imported notes (superseded) |

## Tests and the quality eval

```bash
npm test           # unit tests for the document rules
npm run eval       # note-quality eval (needs ANTHROPIC_API_KEY in .env.local)
```

The eval plays the scribbles in `eval/palmer-luckey.json` through the real refine step in rounds, as the app would, then edits one. It checks every note, both with simple rules and with a judge model (Claude Sonnet 5.5) that flags notes that add, drop or answer things. Reports are written to `eval/out/`. Run it after any change to the prompt.

## Known limits

- Captions come from YouTube's public but undocumented caption endpoint, through the `youtube-transcript` package. It works today, but YouTube can change or block it, and it is more likely to be blocked from cloud hosts such as Vercel than from a home connection. Without captions, notes are still refined, just without context.
- Everything is stored in the browser. Clearing site data deletes your sessions, so export what you want to keep.
- Voice input uses the browser's speech recognition (best in Chrome and Edge).
