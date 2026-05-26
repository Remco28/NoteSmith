# NoteSmith v1 Plan

> Working plan for the first buildable version of NoteSmith.
> Formerly: Scribble → Structure.

## Goal

Build a **YouTube-only, transcript-assisted thinking tool** that helps Frank turn messy live thoughts into a cleaner evolving document while watching a video.

This is **not primarily a note-taking app**. It should be able to support note-taking, but its core job is to help thinking happen *against a transcript*.

## Product summary

NoteSmith is a four-panel workspace:

1. **YouTube Player**
2. **Transcript**
3. **Raw Scribbles**
4. **Living Document**

The key idea is to keep the messy layer and the structured layer separate:
- **Raw Scribbles** = unfiltered thinking
- **Living Document** = AI-shaped output

## v1 decisions locked

### Scope
- **YouTube only**
- **No audio upload**
- **No podcast upload**
- **No transcript fallback**
- **No transcript search**
- **No auth** for v1
- **No spend protection** for v1
- **OpenAI** is the LLM provider for v1
- **Primary user**: Frank
- Future direction: can later open to a few trusted users

### Storage and persistence
- Use **browser localStorage** for local persistence
- Autosave to localStorage is **enabled**
- Exports are the **only durable output**
- No server-side storage in v1
- No user accounts in v1

### UX direction
- Keep the **smith / forging** aesthetic
- Keep **animation in v1**
- Voice and cheer should come from design quality, not motivational copy
- If a transcript is unavailable, show a **clear user-facing message** instead of attempting a fallback

### Voice input
- Include **voice input in v1**
- When the user starts voice recording, **pause the YouTube video**
- The user manually resumes playback
- Do **not** auto-resume playback after recording ends

## Product positioning

NoteSmith is best understood as a **transcript-assisted thinking tool**.

It is not:
- a general knowledge base
- a podcast ingest system
- a full document management app
- a collaborative writing suite
- a transcript search workstation

It is:
- a focused workspace for thinking while consuming a YouTube video
- a tool for turning raw reaction into structured synthesis

## Recommended v1 architecture

### Framework
- **Next.js 15**
- **App Router**
- **TypeScript**

### Frontend
- **Tiptap** for Raw Scribbles editing
- **react-resizable-panels** for panel resizing
- **Web Speech API** for voice input
- local state first; only introduce Zustand if state becomes awkward

### Backend
- Use **Next.js Server Actions** for LLM calls
- Use **OpenAI SDK** server-side
- No separate backend service in v1
- No separate database in v1

### Why this is the right shape
- simplest path to shipping
- keeps API keys off the client
- avoids infrastructure we do not yet need
- matches the stateless / local-persistence-first product shape

## What “backend routes” means here

In this project, “backend routes” just means **server-side code that runs inside the Next.js app**, not in the browser.

For NoteSmith, that means:
- browser gathers transcript + scribbles
- browser triggers a server action
- server action calls OpenAI
- server streams back the Living Document update

So there is no separate “backend app” in v1. The backend logic lives inside the Next.js project.

## Hosting decision for v1

### Recommendation
**Use Vercel for v1.**

### Why
Vercel is easier than self-hosting for this version because:
- Next.js deploys cleanly there
- Server Actions work naturally there
- there is no DB to manage
- there is no durable server-side state to protect
- it reduces ops burden while the product is still proving itself

### Self-hosting later
Self-hosting is still viable later if:
- you want to consolidate everything locally
- you want tighter control over ops
- usage patterns make Vercel awkward
- auth / spend protection / other internal services make local hosting more compelling

But for **v1**, Vercel is the lower-friction option.

## Transcript ingestion decision

### v1 approach
- Use the **official YouTube transcript/captions path only**
- If transcript is unavailable, show a clear “Transcript unavailable” state
- Do not add a fallback fetch path in v1

### Explicit non-decision for now
- no `yt-dlp` fallback in v1
- no unofficial scraper package in v1

## Update behavior

### Decision
Support both:
1. **Update Now** button
2. **Idle-triggered auto update**

### v1 default
- Trigger an AI update after **60 seconds of no typing** in Raw Scribbles
- Also allow manual **Update Now** at any time

### Document update strategy
**Rewrite the whole Living Document each time.**

### Why this is the right v1 tradeoff
Whole-document rewrite is simpler than incremental patching because it avoids:
- merge logic
- diff application complexity
- drift between model state and document state
- partial update bugs

Since v1 is:
- one user
- YouTube only
- transcript-assisted
- local-persistence-first

…whole-document rewrite is the correct simple choice.

### Streaming
The rewrite should be **streamed** into the Living Document so the output feels alive instead of batch-replaced after a long pause.

## Suggested runtime defaults

- **LLM provider:** OpenAI
- **Model:** start with a strong general model; final exact model can be set in env
- **Idle update threshold:** 60s
- **localStorage autosave debounce:** 1s
- **Panel size persistence:** localStorage
- **Living Document generation:** full-document streaming rewrite

## Four-panel layout

```text
┌─────────────────────┬─────────────────────┐
│   YouTube Player    │     Transcript      │
│   (playback ctrl)   │  (current seg hl'd) │
├─────────────────────┼─────────────────────┤
│   Raw Scribbles     │   Living Document   │
│   (typing + voice)  │   (AI streaming)    │
└─────────────────────┴─────────────────────┘
Header: title | auto-update toggle | Update Now button | export actions
```

## Data ownership model

### Browser-owned state
Stored in localStorage:
- raw scribbles
- panel sizes
- auto-update preference
- current working session state as needed

### Derived state
Regenerated from transcript + scribbles:
- living document

### Durable output
- markdown export
- clipboard copy

## Errors and edge cases we should handle in v1

### Transcript unavailable
Show a clear error state such as:
- transcript unavailable
- captions not present for this video
- NoteSmith currently supports transcript-backed YouTube videos only

### OpenAI failure
Show a recoverable message and keep user text intact:
- generation failed
- try again
- do not clear scribbles
- do not clear prior living document unless explicitly intended

### Browser refresh
- restore scribbles from localStorage
- restore layout from localStorage
- restore toggles/preferences from localStorage

## Explicit non-goals for v1

- accounts / multi-user auth
- spend protection
- team collaboration
- server-side note history
- podcast ingest
- audio upload
- transcript search
- transcript fallback pipeline
- vector search / embeddings
- incremental patch-based living document updates

## Work split

### Frank
- frontend style guide
- mascot
- aesthetic direction
- motion and visual feel

### Callum
- backend/server action shape
- product architecture
- document/update behavior
- transcript handling policy
- planning and implementation structure

## Repo structure to create toward

```text
/Projects/NoteSmith
  plan.md
  /docs
    original-project-notes.md
```

Likely later:

```text
/Projects/NoteSmith
  app/
  components/
  lib/
  public/
  docs/
  plan.md
  README.md
  package.json
```

## Immediate next steps

1. Move the existing project note into the repo under `docs/`
2. Keep this `plan.md` as the source of truth for v1 decisions
3. Let Frank develop the visual/style direction in parallel
4. Next planning pass should turn this into an implementation plan before coding begins

## Open questions still worth resolving before implementation

These are smaller than before, but still open:

1. Exact OpenAI model name for v1
2. Exact transcript retrieval library/API integration details for YouTube
3. Exact UX for auto-update toggle states and indicators
4. Whether voice input appends directly into Raw Scribbles or inserts at cursor position
5. Whether Living Document should be persisted locally too for recovery, or always treated as re-derivable

## Current recommendation on that last question

Persisting the Living Document to localStorage is acceptable as a **convenience cache**, but it should still be conceptually treated as derived output, not the canonical source of truth.

Canonical user-owned input remains:
- transcript
- raw scribbles

---

## Bottom line

For v1, NoteSmith should be:
- YouTube-only
- transcript-dependent
- localStorage-backed
- OpenAI-powered
- Vercel-hosted
- whole-document streaming rewrite
- manual update + 60s idle auto-update
- voice input pauses video
- no auth yet

That is small enough to ship and strong enough to learn from.
