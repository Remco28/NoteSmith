# Original NoteSmith Project Notes

Copied from `/home/frank/callum/notes/projects/scribble.md` so the project history lives in the repo.

---

# NoteSmith — Project Notes

*formerly: Scribble → Structure*
*Role: personal browser-based note capture tool for podcasts and videos*
*Last updated: 2026-05-13*

---

## What it is

A single Next.js 15 app deployed on Vercel. Four-panel layout: YouTube video player, transcript (with current-segment highlighting), Raw Scribbles (user's unfiltered thoughts), and Living Document (AI-synthesized structured output). Ephemeral — nothing stored server-side. Export to Markdown when done.

The core insight: separating the messy thinking layer from the structured output layer is cognitively correct. Most tools make you choose between capturing and organizing. This does both without either getting in the way.

**Name rationale**: NoteSmith — raw material in, shaped output out. The smith metaphor earns its place because it's literally what the app does, not decoration layered on top.

---

## Agreed architecture

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | Full-stack, Vercel-native |
| Deployment | Vercel | Zero config for Next.js |
| Rich text | Tiptap (ProseMirror) | Mature, stable, good TS support |
| Panels | react-resizable-panels | Lightweight, purpose-built |
| AI calls | Anthropic or OpenAI SDK via Server Actions | Keys never hit the client |
| Voice input | Web Speech API | Browser-native, zero dependency |
| Export | `Blob` + `<a download>` for .md; Clipboard API for copy | No server needed |
| State | React useState in root + thin Zustand store when it grows | Start simple, don't premature-abstract |

---

## Auth integration (FrankAuthenticator)

Server Actions validate a bearer token against FrankAuthenticator before every LLM API call. Token stored in a Vercel env var. This prevents unauthorized API spend.

```
Request → Server Action → POST frankauth:7432/v1/validate → valid? → call LLM → stream response
```

---

## Layout

```
┌─────────────────────┬─────────────────────┐
│   YouTube Player    │     Transcript      │
│   (playback ctrl)   │  (current seg hl'd) │
├─────────────────────┼─────────────────────┤
│   Raw Scribbles     │   Living Document   │
│   (Tiptap + voice)  │   (AI Markdown,     │
│                     │    streaming)       │
└─────────────────────┴─────────────────────┘
Header: title | auto-update toggle | Update Now button
```

All panels resizable. Sizes persisted in localStorage within the session.

---

## Visual identity & flourishes

**Pixel art smith animation** — while the AI is generating, a small pixel art blacksmith pounds at an anvil. Disappears when the Living Document update completes. Signature animation; earns its place because the metaphor is literal.

**"Forging..." status label** — the generating state reads "Forging..." not "Updating..." or "Generating...". One word, fits the metaphor, doesn't call attention to itself.

**Spark particles** — subtle CSS particle effect on the Living Document panel edge during generation. Faint sparks, gone when done. If it ever feels like too much, it's the first thing to cut.

**Empty state copy** — Raw Scribbles panel shows faint placeholder: *"Raw material goes here."* Disappears the moment typing starts.

**Skipped deliberately**: sound effects, "Cast to Markdown" export copy, color-temperature animation on streaming text.

---

## Key flags — address before building

1. **YouTube transcript source**: Do NOT use `youtube-transcript` npm. It's a scraper that breaks randomly. Use the official YouTube Data API v3 captions endpoint (needs API key, but stable). Fallback: yt-dlp server-side subprocess. This is the #1 stability risk given the "maintainability-first" goal.

2. **Streaming the Living Document**: implement updates as a ReadableStream via Next.js Server Actions, not a 30s debounce-then-replace. The document should feel alive as it updates, not batch-refreshed. Not hard to add; much better UX.

3. **Transcript search**: the mockup shows a search icon in the Transcript panel. The tech spec doesn't cover this. Scope it explicitly before building — it's a feature, not decoration.

4. **Podcast/audio upload**: the vision doc mentions it, the tech spec doesn't. Decide: v1 scope or not?

---

## Open questions before kicking off

- Which LLM provider for v1? (Anthropic for quality, OpenAI for ecosystem — both work, pick one)
- Is transcript search in v1?
- Is audio upload in v1?
- What's the FrankAuthenticator URL/port in the Vercel env config?

---

## Status

Designed. Not started. Frank will initiate build with Callum as architect.
