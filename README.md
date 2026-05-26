# NoteSmith

> Formerly **Scribble → Structure**.

NoteSmith is a **YouTube-only, transcript-assisted thinking tool**.
It helps turn messy live thoughts into a cleaner evolving document while watching a video.

This is **not primarily a note-taking app**. The core idea is to keep two layers separate:

- **Raw Scribbles** → unfiltered thinking
- **Living Document** → AI-shaped output

## Status

Planning and source-material collection are complete.
Implementation has **not** started yet.

Canonical planning doc:
- [`plan.md`](./plan.md)

## Current v1 decisions

### Scope
- YouTube only
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
- Add a user-facing toggle for whether the Living Document answers open questions or preserves them as open notes
- Current default idle threshold: **60 seconds**

### Persistence and hosting
- Browser localStorage for local persistence
- Autosave to localStorage enabled
- Exports are the only durable output
- No server-side storage in v1
- The answer-questions preference should persist locally
- Recommended hosting for v1: **Vercel**

## Recommended implementation shape

- **Next.js 15**
- **App Router**
- **TypeScript**
- **Tiptap** for Raw Scribbles
- **react-resizable-panels** for layout
- **Web Speech API** for voice input
- **Next.js Server Actions** for LLM calls
- **OpenAI SDK** on the server side

## Repo contents

### Canonical
- [`plan.md`](./plan.md) — current source of truth for v1

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
  - Exact implementation path still needs final selection before coding.

- **Auto-update timing**
  - Older docs referenced **30s** inactivity.
  - Current decision: **60s** inactivity default.

- **Persistence**
  - Older docs described a more ephemeral, tab-only experience.
  - Current decision: **localStorage autosave is in scope** for better recovery and continuity.

- **Media scope**
  - Older docs still mentioned podcasts / audio upload as possibilities.
  - Current decision: **not in v1**.

- **Transcript search**
  - Older docs flagged this as unresolved.
  - Current decision: **not in v1**.

## Open questions still worth resolving before implementation

- Exact OpenAI model for v1
- Exact transcript retrieval implementation details for YouTube
- Exact UX for auto-update states and indicators
- Exact UX/copy for the answer-questions toggle
- Whether the Living Document should also be cached locally for recovery

## Next likely steps

- Turn `plan.md` into an implementation task breakdown
- Scaffold the Next.js app
- Convert any high-value legacy docs into concise markdown summaries
- Reconcile the mockup against the locked v1 scope
