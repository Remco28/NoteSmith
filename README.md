# NoteSmith

Scribble while you watch a YouTube video. NoteSmith forges your rough scribbles into notes you can reread without rewatching: it keeps what you meant, makes each note make sense on its own (who "they" are, what "it" is), fills in what the video said, answers your questions, and lays the notes out the way you're using them: numbered steps when you're noting how to do something, topics when you're noting ideas.

- **Raw Scribbles:** type or speak a thought. It's stamped with the moment in the video.
- **Living Document:** each scribble becomes a refined note with a link back to its moment. Notes update a few seconds after you stop adding scribbles.
  - **Layout:** guessed from how you write. If you write "brown the meat first, then drain the oil", you get numbered steps grouped by stage; if you write "why does it brown better? surface area?", you get topics. When your scribbles change character, the whole document is re-forged in the new layout, and the message that says so has an Undo button.
  - **Notes for:** an optional line at the top where you say what the notes are for ("the science behind each technique", "a recipe I can follow"). It decides the layout and which details are worth adding. Changing it re-forges the notes.
  - **History:** every forge keeps the version before it (the last 20). Pick one to look at it, then restore it or go back. Restoring can be undone the same way.
- **Transcript:** follows the video. Click any line to jump there.
- **Export:** copy or download the notes as Markdown, with the raw scribbles below.

It is not a summarizer. Each note has two parts, always shown apart:

- **Your thought**, made readable: your claim, opinion, doubt or question, with vague references named from the video ("high trust in the models" becomes "Anthropic's engineers place high trust in the models to get the code right"). Nothing you didn't think is added to it.
- **A labeled line under it**, when it helps: *From the video* (what was said that your note refers to), *Answer* (the video's answer to your question), or *Answer · general knowledge* (when the video doesn't answer it). Each links to its moment in the video.

The model reads the whole transcript on every forge, so a note can draw on what was said minutes earlier and a question can be answered from later on. Code (not the prompt) guarantees that no scribble is ever dropped.

## How it works

NoteSmith is a static website with **no server**. Everything happens in your browser:

- **Your key** is kept in the browser's local storage and sent straight to Anthropic or OpenAI with each forge. No one else ever sees it.
- **Your sessions** (scribbles and notes) are kept in the same local storage.
- **Transcripts** come from the **NoteSmith bookmark**. YouTube blocks caption downloads from cloud servers, and its pages can't be read by other websites, so the bookmark reads the captions from inside the YouTube page you're on, from your own connection, and opens NoteSmith with them. It prefers captions the creator uploaded over auto-generated ones, and falls back to reading YouTube's "Show transcript" panel. See `lib/bookmarklet.ts`.

**To use it:** open NoteSmith, drag the **NoteSmith** button on the start page to your bookmarks bar, then click that bookmark on any YouTube video. Add your API key in **Settings** (the gear icon). Desktop browsers only; tested in Chrome.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # static site in out/
```

## Publish it on GitHub Pages

`.github/workflows/pages.yml` builds the site and publishes it on every push to `main`. One-time setup: in the repository's **Settings → Pages**, set **Source** to **GitHub Actions**. The site is then at `https://<owner>.github.io/<repository>/`, or at the root of a custom domain set in the same Settings page (this one is at https://notesmith.teamremco.org/). The workflow asks GitHub which folder the site is served from and builds for it. Any static host works: build with `NOTESMITH_BASE_PATH` set to the folder it's served from, or unset for the root.

## API keys and models

Each person uses their own key:

- **Provider:** Anthropic (default) or OpenAI.
- **Model:** any model id. The default is `claude-sonnet-5-5`. `claude-haiku-5-5` costs about a twentieth as much, but often leaves notes vague (it doesn't name who "they" are).
- **Cost:** every forge sends the whole transcript (about 25,000 tokens per hour of video). It is cached for an hour after its last use, so only the first forge pays to send it in full; later ones read it at a tenth of the price. With Sonnet 5.5 that's roughly 10 to 20 cents for the first forge on an hour-long video and about 1 cent for each one after. The Living Document shows what the current video has cost so far (hover it for the token breakdown), and the start page shows each video's cost and the total. Both are worked out from the token counts the API reports, using the prices in `lib/llm/prices.ts`; update that table when prices change. OpenAI models have no prices there yet, so only their tokens are counted.

## Where things are

| Path | What |
|---|---|
| `lib/doc.ts` | The rules that keep scribbles safe: what needs refining, applying the model's answer, ordering, Markdown export |
| `lib/refine/prompt.ts` | The forging prompt (what goes in a note, what goes in its detail, how questions are handled) and the JSON schema |
| `lib/refine/run.ts` | Calls the model from the browser, checks the answer, retries anything it left out |
| `lib/llm/` | Anthropic and OpenAI adapters |
| `lib/bookmarklet.ts` | The NoteSmith bookmark (gets captions on youtube.com) and reading what it sends |
| `components/Workspace.tsx` | App state, forging loop, layout |
| `components/smith-sprite.ts` | The pixel blacksmith |
| `docs/DESIGN.md` | Design decisions and the words the app uses |
| `docs/history/` | The original v1 plan and imported notes (superseded) |

## Tests and the quality eval

```bash
npm test           # unit tests for the document rules
npm run eval       # note-quality eval, in Node (needs ANTHROPIC_API_KEY in .env.local)
```

The eval plays a fixture's scribbles through the real forging step in rounds, as the app would. `eval/katelyn-lesse.json` (the default) is a real user's scribbles; `eval/palmer-luckey.json` is a longer made-up set; `eval/tricky.json` holds the hard cases testers found (pointing words, corrections, doubt). A judge model (Claude Sonnet 5.5) reads the whole transcript and flags both failures: notes that say too much (not what you thought, inaccurate details) and too little (still vague, a needed detail missing). Pass `--model claude-haiku-5-5` to compare models. Reports are written to `eval/out/`. Run it after any change to the prompt.

## Known limits

- Transcripts rely on YouTube's undocumented caption endpoint and its transcript panel. YouTube can change either; the bookmark tries both. Without a transcript, notes are still tidied and grouped, but nothing is filled in from the video.
- A transcript is remembered for the last few videos. For an older one, click the bookmark on its YouTube page again.
- General-knowledge answers come from the model, not the video, and can be wrong. They are labeled as such.
- Everything is stored in the browser. Clearing site data deletes your sessions, so export what you want to keep.
- Voice input uses the browser's speech recognition (best in Chrome and Edge, which send the audio to Google or Microsoft to transcribe).
