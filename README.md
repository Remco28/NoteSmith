# NoteSmith

Scribble while you watch a YouTube video. NoteSmith forges your rough scribbles into notes you can reread without rewatching: it keeps what you meant, makes each note make sense on its own (who "they" are, what "it" is), fills in what the video said, answers your questions, and groups the notes by topic.

- **Raw Scribbles:** type or speak a thought. It's stamped with the moment in the video.
- **Living Document:** each scribble becomes a refined note, grouped under topics, with a link back to its moment. Notes update a few seconds after you stop adding scribbles.
- **Transcript:** follows the video. Click any line to jump there.
- **Export:** copy or download the notes as Markdown, with the raw scribbles below.

It is not a summarizer. Each note has two parts, always shown apart:

- **Your thought**, made readable: your claim, opinion, doubt or question, with vague references named from the video ("high trust in the models" becomes "Anthropic's engineers place high trust in the models to get the code right"). Nothing you didn't think is added to it.
- **A labeled line under it**, when it helps: *From the video* (what was said that your note refers to), *Answer* (the video's answer to your question), or *Answer · general knowledge* (when the video doesn't answer it). Each links to its moment in the video.

The model reads the whole transcript on every forge, so a note can draw on what was said minutes earlier and a question can be answered from later on. Code (not the prompt) guarantees that no scribble is ever dropped.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Open the app, paste a YouTube link, and add your API key in **Settings** (the gear icon).

## API keys and models

Each person uses their own key:

- **Provider:** Anthropic (default) or OpenAI.
- **Model:** any model id. The default is `claude-sonnet-5-5`. `claude-haiku-5-5` costs about a twentieth as much, but often leaves notes vague (it doesn't name who "they" are).
- **Cost:** every forge sends the whole transcript (about 25,000 tokens per hour of video). It is cached for an hour after its last use, so only the first forge pays to send it in full; later ones read it at a tenth of the price. With Sonnet 5.5 that's roughly 10 to 20 cents for the first forge on an hour-long video and about 1 cent for each one after.
- The key is kept only in the browser's local storage and sent with each forge request. The server uses it for that request and never stores or logs it.

**A key on the server (optional).** Put `ANTHROPIC_API_KEY` and/or `OPENAI_API_KEY` in `.env.local` and the app works without entering a key in the browser. For safety, the server's key is used **only for requests to localhost**. On a public deployment it's ignored, unless you set `NOTESMITH_SHARE_SERVER_KEY=true`, which lets anyone with the URL spend your credits. See `.env.example`.

## Where things are

| Path | What |
|---|---|
| `lib/doc.ts` | The rules that keep scribbles safe: what needs refining, applying the model's answer, ordering, Markdown export |
| `lib/refine/prompt.ts` | The forging prompt (what goes in a note, what goes in its detail, how questions are handled) and the JSON schema |
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

The eval plays a fixture's scribbles through the real forging step in rounds, as the app would. `eval/katelyn-lesse.json` (the default) is a real user's scribbles; `eval/palmer-luckey.json` is a longer made-up set; `eval/tricky.json` holds the hard cases testers found (pointing words, corrections, doubt). A judge model (Claude Sonnet 5.5) reads the whole transcript and flags both failures: notes that say too much (not what you thought, inaccurate details) and too little (still vague, a needed detail missing). Pass `--model claude-haiku-5-5` to compare models. Reports are written to `eval/out/`. Run it after any change to the prompt.

## Known limits

- Captions come from YouTube's public but undocumented caption endpoint, through the `youtube-transcript` package. It works today, but YouTube can change or block it, and it is more likely to be blocked from cloud hosts such as Vercel than from a home connection. Without captions, notes are still tidied, but nothing is filled in from the video.
- General-knowledge answers come from the model, not the video, and can be wrong. They are labeled as such.
- Everything is stored in the browser. Clearing site data deletes your sessions, so export what you want to keep.
- Voice input uses the browser's speech recognition (best in Chrome and Edge).
