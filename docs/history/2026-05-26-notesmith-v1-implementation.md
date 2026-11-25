# NoteSmith v1 Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to execute this plan task-by-task.

**Goal:** Build the first working NoteSmith v1 app: a YouTube-only, transcript-assisted thinking workspace with four panels, local persistence, voice capture, and AI-generated Living Document updates.

**Architecture:** A single Next.js 15 App Router app deployed on Vercel. Browser owns session state through localStorage. Server-side app code handles transcript retrieval normalization and OpenAI generation. The Living Document is regenerated as a full-document streaming rewrite, but the desired output shape is brief note refinement rather than long-form summary.

**Tech Stack:** Next.js 15, TypeScript, React, Tailwind CSS, Tiptap, react-resizable-panels, OpenAI SDK, Web Speech API.

---

## Locked product decisions to honor

- YouTube only
- No auth in v1
- No spend protection in v1
- No transcript search
- No transcript fallback pipeline
- No audio / podcast upload
- OpenAI provider
- localStorage autosave
- Exports are the only durable output
- Voice input pauses video and appends as a new scribble entry
- User manually resumes playback
- Manual `Update Now` + 60s idle auto-update
- Whole-document streaming rewrite for Living Document
- Output should err on the side of brevity
- Scribbles are the main unit of intent; transcript context should support them rather than overwhelm them
- Questions should normally remain open notes/questions rather than being auto-answered
- The Living Document should render as a clearly formatted markdown note, not raw-looking text
- After a video loads, player controls should collapse into a smaller bar to preserve player space
- Living Document may be cached locally as a convenience, but remains derived output

### Post-build product-direction note

After the first working build, the desired behavior became clearer:

- NoteSmith should behave more like an **intelligent note refiner** than a transcript summarizer.
- Scribbles may be questions, fragments, reactions, lists of names, or half-formed tangents.
- The output should usually be a **short useful note**, not a long recap of the episode.
- Questions are often part of thinking out loud, so the product should stop treating them as implicit answer requests.
- A future refinement may split generation into two passes:
  1. infer scribble intent
  2. generate the output in the right shape

That two-pass idea is promising but **not yet mandatory**.

---

## Execution gates

### Gate A — Transcript source must be validated before transcript-dependent coding proceeds

We already verified that the official YouTube Data API captions endpoints require OAuth scopes and are not the simple API-key-only solution we hoped for.

That means the implementation must first validate a **real server-side transcript retrieval path for arbitrary public captioned YouTube videos**.

Acceptable outcome for the gate:
- a concrete adapter choice,
- one tested captioned video returning normalized segments,
- one tested non-captioned video producing `TranscriptUnavailableError`,
- a short doc recording the choice and tradeoffs.

Until Gate A passes:
- scaffold/UI work can proceed,
- transcript-panel placeholder work can proceed,
- final transcript integration cannot be considered complete.

---

## Target repo shape

```text
/home/frank/Projects/NoteSmith
  app/
    api/
      living-document/route.ts
      transcript/route.ts
    globals.css
    layout.tsx
    page.tsx
  components/
    header/
      Header.tsx
    player/
      YouTubePlayer.tsx
      VideoUrlForm.tsx
    transcript/
      TranscriptPanel.tsx
      TranscriptUnavailable.tsx
    scribbles/
      ScribblesPanel.tsx
      ScribbleEntryCard.tsx
      VoiceRecorder.tsx
    living-document/
      LivingDocumentPanel.tsx
    workspace/
      WorkspaceLayout.tsx
  docs/
    plans/
      2026-05-26-notesmith-v1-implementation.md
    technical-decisions/
      transcript-source.md
  lib/
    errors.ts
    openai.ts
    storage.ts
    transcript/
      adapter.ts
      normalize.ts
    utils/
      checksum.ts
      time.ts
      youtube.ts
  types/
    notesmith.ts
  .env.example
  README.md
  plan.md
```

---

## Task 1: Scaffold the app

**Objective:** Create the baseline Next.js app and install the core dependencies without adding product logic yet.

**Files:**
- Create: `app/*`, `components/*`, `lib/*`, `types/*`
- Create: `.env.example`
- Modify: `package.json`

**Steps:**
1. Run the scaffold from repo root:
   - `npx create-next-app@latest . --ts --tailwind --eslint --app --use-npm --import-alias "@/*"`
2. Install dependencies:
   - `npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-placeholder react-resizable-panels openai`
3. Create empty folder structure for `components/`, `lib/`, `types/`, and docs subfolders.
4. Add `.env.example` with:
   - `OPENAI_API_KEY=`
   - `OPENAI_MODEL=gpt-4o`
   - `YOUTUBE_TRANSCRIPT_PROVIDER=`
5. Run:
   - `npm run lint`

**Verification:**
- `npm run lint` passes
- `npm run dev` starts a clean Next.js app

**Commit:**
- `git commit -m "chore: scaffold NoteSmith app"`

---

## Task 2: Add shared types, errors, and constants

**Objective:** Establish the canonical TypeScript shapes before any feature logic is written.

**Files:**
- Create: `types/notesmith.ts`
- Create: `lib/errors.ts`
- Create: `lib/utils/time.ts`
- Create: `lib/utils/youtube.ts`

**Required exports:**
- `TranscriptSegment`
- `ScribbleEntry`
- `LivingDocumentState`
- `WorkspaceSettings`
- `PersistedWorkspaceState`
- `TranscriptUnavailableError`
- `extractVideoId(input: string)`
- `formatSeconds(seconds: number)`

**Verification:**
- `npm run lint`
- `npm run build`

**Commit:**
- `git commit -m "feat: add shared NoteSmith domain types"`

---

## Task 3: Add local persistence helpers

**Objective:** Create a single localStorage layer for workspace state and keep it isolated from UI components.

**Files:**
- Create: `lib/storage.ts`
- Create: `lib/utils/checksum.ts`

**Requirements:**
- Persist:
  - current video ID
  - transcript cache for current session
  - scribbles
  - living document cache
  - panel sizes
  - `autoUpdateEnabled`
  - `answerQuestions`
- 1-second debounce for write-heavy updates
- Living Document cache keyed by `videoId + scribbles checksum`
- Browser-only guards (`typeof window !== "undefined"`)

**Verification:**
- `npm run lint`
- manual browser refresh preserves state during local dev

**Commit:**
- `git commit -m "feat: add workspace local persistence layer"`

---

## Task 4: Build the top-level workspace shell

**Objective:** Replace the default Next.js page with the real four-panel workspace shell and header controls.

**Files:**
- Modify: `app/page.tsx`
- Create: `components/workspace/WorkspaceLayout.tsx`
- Create: `components/header/Header.tsx`

**Requirements:**
- Four-panel layout with resizable panels
- Header includes:
  - app title
  - auto-update toggle/status
  - `Update Now` button
  - export actions placeholder
- Auto-update states:
  - `Auto-updates on · last: …`
  - `Manual only`
  - `Updating…`
- No real feature logic yet; placeholders are fine

**Verification:**
- `npm run dev`
- layout renders correctly with placeholder panels
- resizing updates local state without crashes

**Commit:**
- `git commit -m "feat: add NoteSmith workspace shell"`

---

## Task 5: Add YouTube URL intake and player wrapper

**Objective:** Let the user paste a YouTube URL, extract the video ID, and mount a player wrapper that exposes playback time and pause control.

**Files:**
- Create: `components/player/VideoUrlForm.tsx`
- Create: `components/player/YouTubePlayer.tsx`
- Modify: `app/page.tsx`
- Modify: `lib/utils/youtube.ts`

**Requirements:**
- Accept common YouTube URL formats
- Reject invalid URLs cleanly
- Player wrapper must expose:
  - current playback time
  - pause method
  - ready state
- Do not auto-play by default

**Verification:**
- paste valid YouTube URL → player loads
- invalid URL → user-facing validation message
- playback time updates while video plays

**Commit:**
- `git commit -m "feat: add YouTube URL intake and player wrapper"`

---

## Task 6: Pass Gate A with a transcript spike

**Objective:** Validate the actual transcript retrieval strategy before integrating transcript logic into the app.

**Files:**
- Create: `docs/technical-decisions/transcript-source.md`
- Create: `lib/transcript/adapter.ts`
- Create: `lib/transcript/normalize.ts`
- Create or modify: `app/api/transcript/route.ts`

**Requirements:**
- Try the candidate adapter on:
  - one public video with captions
  - one public video without captions
- Normalize output to:
  - `{ start: number, end: number, text: string }[]`
- Throw `TranscriptUnavailableError` when captions are missing/unusable
- Write decision doc recording:
  - chosen adapter
  - why the official captions API was rejected
  - known fragility/risk
  - exact user-facing failure behavior

**Verification:**
- local route returns normalized transcript for test video
- local route returns transcript-unavailable error for non-captioned test video
- decision doc exists and matches actual code path

**Commit:**
- `git commit -m "feat: validate transcript retrieval path"`

---

## Task 7: Build the transcript panel

**Objective:** Display transcript segments, highlight the active segment, and show the locked v1 unavailable state when needed.

**Files:**
- Create: `components/transcript/TranscriptPanel.tsx`
- Create: `components/transcript/TranscriptUnavailable.tsx`
- Modify: `app/page.tsx`

**Requirements:**
- Render transcript segment list
- Highlight current segment based on player time
- Scroll active segment into view
- Unavailable state copy should clearly say NoteSmith supports captioned YouTube videos only

**Verification:**
- captioned video → transcript appears and highlight follows playback
- non-captioned video → unavailable panel renders

**Commit:**
- `git commit -m "feat: add transcript panel and unavailable state"`

---

## Task 8: Build Raw Scribbles

**Objective:** Implement the actual scribble-taking experience with timestamped entries and deletion.

**Files:**
- Create: `components/scribbles/ScribblesPanel.tsx`
- Create: `components/scribbles/ScribbleEntryCard.tsx`
- Modify: `app/page.tsx`

**Requirements:**
- Tiptap editor for typed scribbles
- Raw scribbles remain fully editable
- Scribble entries are timestamped to playback time
- Entries are deletable
- Preserve the separation between raw input and living document output

**Verification:**
- typing works
- entries persist on refresh
- timestamps reflect playback time
- deletion updates state cleanly

**Commit:**
- `git commit -m "feat: add raw scribbles workflow"`

---

## Task 9: Add voice input

**Objective:** Add Web Speech API support that appends voice transcription as a new scribble entry and pauses playback at recording start.

**Files:**
- Create: `components/scribbles/VoiceRecorder.tsx`
- Modify: `components/scribbles/ScribblesPanel.tsx`
- Modify: `components/player/YouTubePlayer.tsx`

**Requirements:**
- Start recording → pause YouTube player
- End recording → append a new voice scribble entry
- No auto-resume after recording ends
- Browser support guard for missing SpeechRecognition

**Verification:**
- recording pauses playback
- resulting transcript becomes a new scribble entry
- unsupported browser shows a graceful disabled state

**Commit:**
- `git commit -m "feat: add voice scribble capture"`

---

## Task 10: Add Living Document generation

**Objective:** Implement the first server-side OpenAI generation path and the client-side streaming display.

**Files:**
- Create: `app/api/living-document/route.ts`
- Create: `lib/openai.ts`
- Create: `components/living-document/LivingDocumentPanel.tsx`
- Modify: `app/page.tsx`

**Requirements:**
- Default model: `gpt-4o`
- Allow override with `OPENAI_MODEL`
- Input to generation:
  - transcript
  - raw scribbles
- Output:
  - whole-document markdown rewrite
  - streamed into the Living Document panel
  - **brief by default**, unless the scribble clearly calls for broader synthesis
- Preserve prior user state on generation failure
- Treat the scribble as the main unit of intent; transcript context is supporting evidence, not the main subject

**Verification:**
- `Update Now` produces a streamed Living Document
- narrow scribbles produce compact useful notes rather than episode-length summaries
- question-shaped scribbles remain useful open notes unless the user clearly turns them into claims
- generation failure leaves scribbles intact and shows retryable error state

**Commit:**
- `git commit -m "feat: add living document generation"`

---

## Task 11: Add update orchestration

**Objective:** Connect manual and idle-triggered generation behavior without race conditions.

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/header/Header.tsx`
- Modify: `lib/storage.ts`

**Requirements:**
- `Update Now` always available unless already updating
- Idle auto-update fires after 60 seconds of no scribble changes
- Toggle between auto/manual modes
- While updating:
  - disable duplicate update fires
  - show `Updating…`
  - refresh `last updated` timestamp on success

**Verification:**
- manual update works with auto-update on or off
- idle update fires once after 60 seconds of inactivity
- repeated keystrokes reset the timer

**Commit:**
- `git commit -m "feat: add update orchestration"`

---

## Task 12: Add export and recovery polish

**Objective:** Finish the v1 loop with export actions, cache recovery, and basic error-state polish.

**Files:**
- Modify: `components/header/Header.tsx`
- Modify: `lib/storage.ts`
- Modify: `components/living-document/LivingDocumentPanel.tsx`
- Modify: `README.md`

**Requirements:**
- Export to Markdown download
- Copy Living Document to clipboard
- Restore Living Document cache on refresh
- Keep clear recoverable errors for:
  - transcript unavailable
  - generation failure
  - unsupported voice input
- Update README run instructions if needed

**Verification:**
- markdown download works
- clipboard copy works
- page refresh restores cached state
- `npm run lint && npm run build` pass

**Commit:**
- `git commit -m "feat: finish NoteSmith v1 workflow"`

---

## Recommended first execution batch

Start with these in order:
1. Task 1 — Scaffold the app
2. Task 2 — Add shared types, errors, and constants
3. Task 4 — Build the top-level workspace shell
4. Task 6 — Pass Gate A with a transcript spike

Reason: this gets the repo into a buildable state quickly, while separating the transcript risk from the rest of the UI work.

---

## Controller notes for minions

- Do **not** introduce auth, accounts, or a database.
- Do **not** add transcript search.
- Do **not** add an audio upload path.
- Keep state management simple; no Zustand unless React state becomes painful.
- Prefer small focused commits.
- If transcript retrieval requires a compromise, document it explicitly in `docs/technical-decisions/transcript-source.md` instead of hiding it.
- If a minion claims external behavior works, verify with a local run or returned artifact before accepting success.
