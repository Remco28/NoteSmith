# NoteSmith

> Formerly **Scribble → Structure**.

NoteSmith is a **YouTube-only, transcript-assisted thinking tool**.
It helps turn messy live thoughts into a cleaner evolving document while watching a video.

This is **not primarily a note-taking app**. The core idea is to keep two layers separate:

- **Raw Scribbles** → unfiltered thinking
- **Living Document** → AI-shaped output

## Status

✅ **v1 implementation complete.** All planned features are built and working.

Canonical planning doc:
- [`plan.md`](./plan.md) — source of truth
- [`docs/plans/2026-05-26-notesmith-v1-implementation.md`](./docs/plans/2026-05-26-notesmith-v1-implementation.md) — implementation log

## Run instructions

```bash
# 1. Use the existing repo
cd /home/frank/Projects/NoteSmith

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Then edit .env.local and fill in your key:
#   OPENAI_API_KEY=sk-...
#   OPENAI_MODEL=gpt-4o  (optional, defaults to gpt-4o)

# 4. Start the dev server
npm run dev

# 5. Open in browser
# http://localhost:3000
```

### Required environment variables

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | Your OpenAI API key |

### Optional environment variables

| Variable | Default | Description |
|---|---|---|
| `OPENAI_MODEL` | `gpt-4o` | OpenAI model to use for Living Document generation |

## Current v1 decisions

### Scope
- YouTube only (captioned videos only — transcript retrieval via an undocumented YouTube transcript adapter)
- No audio upload
- No podcast upload
- No transcript fallback
- No transcript search
- No auth in v1
- No spend protection in v1
- OpenAI is the LLM provider for v1

### Product shape
- Four-panel layout:
  - YouTube Player
  - Transcript
  - Raw Scribbles
  - Living Document
- Primary purpose: **transcript-assisted thinking**, not generic notes
- Raw Scribbles are fully editable
- Raw Scribbles entries are deletable
- Raw Scribbles entries are timestamped to playback
- Voice input is included in v1
- Voice input appends as a new Raw Scribbles entry
- Starting voice recording pauses the video
- User manually resumes playback
- Whole-document Living Document rewrites
- Manual **Update Now** + idle auto-update
- User-facing toggle for whether the Living Document answers open questions or preserves them as open notes
- Idle threshold: **60 seconds**

### Persistence and hosting
- Browser localStorage for local persistence
- Autosave to localStorage enabled
- Living Document is cached locally (keyed by video ID + scribbles checksum) and restored on refresh
- Exports are the only durable output (Markdown download and clipboard copy)
- No server-side storage in v1
- Recommended hosting for v1: **Vercel**

## Repo contents

### Canonical
- [`plan.md`](./plan.md) — current source of truth for v1
- [`docs/plans/2026-05-26-notesmith-v1-implementation.md`](./docs/plans/2026-05-26-notesmith-v1-implementation.md) — implementation task breakdown

### Historical / reference
- [`docs/original-project-notes.md`](./docs/original-project-notes.md) — original local project note copied into the repo
- [`docs/drive-import/notesmith-project-notes.txt`](./docs/drive-import/notesmith-project-notes.txt) — imported Drive note
- [`docs/drive-import/scribble-structure-project-notes.txt`](./docs/drive-import/scribble-structure-project-notes.txt) — imported Drive note
- `docs/drive-import/Scribble_Structure_Technical_Specification.docx` — imported technical spec
- `docs/drive-import/Scribble_Structure_Vision_Document.docx` — imported vision doc
- `assets/reference/scribble_mockup.jpg` — imported visual reference

## Which document should drive build decisions?

Use this order:
1. `plan.md`
2. `README.md`
3. historical/reference docs under `docs/`

If an older doc conflicts with `plan.md`, **`plan.md` wins**.

## Notable historical differences already resolved

These were present in older docs but have now been decided differently:

- **Auth / spend protection**
  - Older docs included FrankAuthenticator validation before LLM calls.
  - Current decision: **defer auth and spend protection for v1**.

- **Transcript source policy**
  - Older docs considered scraper/fallback approaches and one spec mentioned `youtube-transcript`.
  - Current decision: **YouTube-only and no transcript fallback in v1**.
  - Implementation: **Node-side `youtube-transcript` adapter over YouTube's undocumented caption path**.

- **Auto-update timing**
  - Older docs referenced **30s** inactivity.
  - Current decision: **60s** inactivity default.

- **Persistence**
  - Older docs described a more ephemeral, tab-only experience.
  - Current decision: **localStorage autosave is in scope** for better recovery and continuity.
  - Living Document caching with checksum-based invalidation added in v1.

- **Media scope**
  - Older docs still mentioned podcasts / audio upload as possibilities.
  - Current decision: **not in v1**.

- **Transcript search**
  - Older docs flagged this as unresolved.
  - Current decision: **not in v1**.

## Open questions resolved by v1

- **Exact OpenAI model for v1** → `gpt-4o` (default), overridable via `OPENAI_MODEL`
- **Exact transcript retrieval implementation** → Node-side `youtube-transcript` adapter
- **Exact UX for auto-update states** → `Auto-updates on · last: <time>`, `Manual only`, `Updating…`
- **Exact UX/copy for the answer-questions toggle** → "Answer questions" checkbox with clear prompt impact
- **Living Document local caching** → ✅ implemented, keyed by `videoId + scribbles checksum`