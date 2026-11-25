# Transcript Source Decision — NoteSmith Gate A

**Date:** 2026-05-26  
**Status:** DECIDED — adapter direction chosen; live implementation validation still required  
**Product:** NoteSmith v1  

---

## Background

NoteSmith v1 is a YouTube-only, transcript-assisted thinking tool. The transcript is a required dependency — there is no fallback pipeline and no user authentication in v1.

Before coding the transcript panel, we must validate that a real server-side transcript retrieval path exists for arbitrary public captioned YouTube videos.

---

## Verified Official API Limitation

**YouTube Data API v3 captions endpoints require OAuth — not an API key.**

The official YouTube Data API v3 provides two captions-related endpoints:

| Endpoint | Authorization |
|---|---|
| `captions.list` | OAuth scope `https://www.googleapis.com/auth/youtube.force-ssl` |
| `captions.download` | OAuth scope `https://www.googleapis.com/auth/youtube.force-ssl` |

Both are listed in the official API documentation as requiring authorization. They are **not accessible with a simple API key** — they require full OAuth flow with user consent.

For a v1 product with **no user auth** and targeting arbitrary public videos (not just videos the authenticated user owns), the official API is not a viable path.

---

## Recommended v1 Approach

**Adapter direction:** use a **Node-side undocumented-caption adapter** behind a thin server-side wrapper  
**Practical package candidate:** `youtube-transcript` npm package (`npm view` currently reports version `1.3.1`)  
**Alternative reference implementation:** `youtube-transcript-api` (Python)

The important architectural choice is not Python vs npm — it is that the app must use the **internal undocumented YouTube web client caption path**, not the official Data API v3.

For this Next.js app, the preferred shape is a **Node-native adapter** so transcript fetching stays inside the existing server runtime and avoids subprocess complexity on Vercel.

Key properties:
- **No API key required** — bypasses the official API entirely
- **No OAuth required** — works without user authentication
- **Works on arbitrary public videos** — if a video has auto-generated or manually uploaded captions, the adapter may retrieve them
- **Server-side compatible** — no headless browser needed

### Adapter Contract

The adapter must expose:

```typescript
interface TranscriptSegment {
  start: number;   // seconds
  end: number;     // seconds
  text: string;
}

function fetchTranscript(videoId: string): Promise<TranscriptSegment[]>;
```

Normalized output shape: `{ start: number, end: number, text: string }[]`

When captions are unavailable, throw `TranscriptUnavailableError`.

---

## Why Not `yt-dlp`?

`yt-dlp` is a more robust tool but:
- Heavier dependency (binary or pip package)
- Not natively Node.js — adds subprocess or bridge complexity
- Explicitly deferred per the v1 plan ("no `yt-dlp` fallback in v1")

`youtube-transcript-api` is lighter and sufficient for the happy path.

---

## Known Risk and Fragility

**The internal API is undocumented and unofficial.**

From the `youtube-transcript-api` README:

> "This code uses an undocumented part of the YouTube API, which is called by the YouTube web-client. So there is no guarantee that it won't stop working tomorrow, if they change how things work."

Specific fragility vectors:

| Risk | Severity | Mitigation |
|---|---|---|
| YouTube changes internal caption API | High | Monitor breakage; document fallback path for v2 |
| Video has no captions at all | Expected | Catch `TranscriptUnavailableError` → show user-facing unavailable state |
| Age-restricted or member-only videos | Medium | Not supported; these will surface as unavailable |
| Rate limiting from YouTube | Low-Medium | Add basic retry with backoff in adapter |

**There is no fix for API breakage except updating the library or pivoting to a different retrieval method.**

---

## Exact User-Facing Failure Mode

When a video has no captions (auto-generated or manual):

1. The transcript fetch returns `TranscriptUnavailableError`
2. The UI shows the **unavailable transcript panel** state
3. The exact copy is: *"NoteSmith currently supports transcript-backed YouTube videos only"*
4. The user cannot proceed with transcript-assisted features

This is the **expected and acceptable failure mode** per the locked v1 product constraints.

The user is shown what the product is: transcript-dependent, no fallback. They must pick a different video.

---

## Vercel Compatibility

The adapter should run inside the normal Next.js server runtime (Server Action or Route Handler). Considerations:

- **Prefer Node-native implementation:** avoid Python subprocesses inside the app runtime unless a later spike proves that is truly necessary.
- **Execution time limits:** transcript retrieval needs to stay comfortably within serverless request limits; keep the adapter thin and cache transcript results locally by video ID in the browser.
- **No headless browser:** if the chosen approach ever requires Puppeteer or full browser automation, reject it for v1.

---

## Implementation Notes

The adapter lives at `lib/transcript/adapter.ts`. A thin normalization layer at `lib/transcript/normalize.ts` ensures consistent output shape regardless of which underlying library is used.

For v1, the implementation spike should verify:
1. One known-captioned public video → returns normalized segments
2. One known non-captioned video → throws `TranscriptUnavailableError`
3. The chosen Node-side adapter works inside local Next.js runtime without extra services

Only after those three checks pass should Gate A be considered fully closed.

---

## Alternative Considered: Do Nothing

If no viable transcript path existed, v1 would have had to ship as a video-only tool without transcript-assisted features — which would have contradicted the core product purpose. That outcome is now avoided.

---

## References

- YouTube Data API v3 captions docs: https://developers.google.com/youtube/v3/docs/captions/list
- youtube-transcript-api (Python): https://github.com/jdepoix/youtube-transcript-api
- NoteSmith v1 plan: `docs/plans/2026-05-26-notesmith-v1-implementation.md`