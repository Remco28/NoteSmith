/**
 * The "NoteSmith" bookmark. Clicked on a YouTube video page, it reads the
 * video's captions from inside that page (so the request comes from the
 * user's own browser and connection, which YouTube allows, where it blocks
 * cloud servers) and opens NoteSmith with the transcript in the URL hash.
 * The hash never leaves the browser.
 *
 * Two ways to get captions, tried in order:
 * 1. YouTube's player API (the Android client), then the caption file.
 *    Prefers captions the creator uploaded over auto-generated ones.
 * 2. YouTube's own "Show transcript" panel, read straight from the page.
 *
 * This is plain JavaScript kept as a string, not compiled app code: it runs
 * on youtube.com, where none of the app's bundle exists. It sets text with
 * textContent only (YouTube enforces Trusted Types, which blocks innerHTML).
 */

export const IMPORT_PREFIX = "#import=";

/** Format version of the data the bookmark sends. Bump if its shape changes. */
export const IMPORT_VERSION = 1;

const SOURCE = String.raw`(async () => {
  const APP = "__APP__";
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;z-index:2147483647;top:16px;right:16px;max-width:360px;padding:12px 16px;border-radius:8px;background:#1c1917;color:#f5f0e8;font:14px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.4);border:1px solid #e8772e";
  const say = (t) => { box.textContent = "NoteSmith: " + t; if (!box.isConnected) document.body.appendChild(box); };
  const fail = (t) => { say(t); setTimeout(() => box.remove(), 9000); };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clean = (t) => String(t || "").replace(/\s+/g, " ").trim();

  const url = new URL(location.href);
  const id = url.searchParams.get("v") || (url.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{11})/) || [])[1];
  if (!/(^|\.)youtube\.com$/.test(location.hostname) || !id) {
    alert("NoteSmith: open a YouTube video first, then click this bookmark.");
    return;
  }
  say("getting the transcript…");

  let title = null, author = null, segs = null, source = null, lang = null;

  try {
    const res = await fetch("/youtubei/v1/player?prettyPrint=false", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: { client: { clientName: "ANDROID", clientVersion: "20.10.38", hl: "en" } }, videoId: id }),
    });
    const data = await res.json();
    title = (data.videoDetails && data.videoDetails.title) || null;
    author = (data.videoDetails && data.videoDetails.author) || null;
    const tracks = (data.captions && data.captions.playerCaptionsTracklistRenderer && data.captions.playerCaptionsTracklistRenderer.captionTracks) || [];
    const want = (navigator.language || "en").slice(0, 2).toLowerCase();
    const score = (t) => (t.languageCode.startsWith(want) ? 4 : t.languageCode.startsWith("en") ? 2 : 0) + (t.kind === "asr" ? 0 : 1);
    const track = tracks.slice().sort((a, b) => score(b) - score(a))[0];
    if (track) {
      const cap = new URL(track.baseUrl, location.origin);
      cap.searchParams.set("fmt", "json3");
      const json = await (await fetch(cap)).json();
      const events = (json.events || []).filter((e) => e.segs);
      const out = [];
      for (const e of events) {
        const text = clean(e.segs.map((s) => s.utf8).join(""));
        if (text) out.push([e.tStartMs / 1000, (e.tStartMs + (e.dDurationMs || 0)) / 1000, text]);
      }
      if (out.length) { segs = out; source = track.kind === "asr" ? "auto" : "uploaded"; lang = track.languageCode; }
    }
  } catch (e) { /* fall through to the transcript panel */ }

  if (!segs) {
    try {
      say("reading YouTube's transcript panel…");
      const find = () => document.querySelectorAll("ytd-transcript-segment-renderer, transcript-segment-view-model");
      if (!find().length) {
        const more = document.querySelector("#description-inline-expander #expand, tp-yt-paper-button#expand");
        if (more) { more.click(); await sleep(800); }
        const btn = Array.from(document.querySelectorAll("button")).find((b) => /show transcript/i.test((b.getAttribute("aria-label") || "") + " " + (b.textContent || "")));
        if (btn) btn.click();
        for (let i = 0; i < 30 && !find().length; i++) await sleep(400);
      }
      const stamp = /^\d+(?::\d{2}){1,2}$/;
      const spoken = /^(\d+ (hours?|minutes?|seconds?),? ?)+$/i;
      const out = [];
      for (const el of find()) {
        const lines = (el.innerText || "").split("\n").map(clean).filter(Boolean);
        const t = lines.find((l) => stamp.test(l));
        if (!t) continue;
        const start = t.split(":").reduce((n, p) => n * 60 + Number(p), 0);
        const text = clean(lines.filter((l) => !stamp.test(l) && !spoken.test(l)).join(" "));
        if (text) out.push([start, start, text]);
      }
      for (let i = 0; i < out.length; i++) out[i][1] = i + 1 < out.length ? out[i + 1][0] : out[i][0] + 5;
      if (out.length) { segs = out; source = "panel"; }
    } catch (e) { /* nothing left to try */ }
  }

  if (!title) title = (document.title || "").replace(/^\(\d+\)\s*/, "").replace(/\s*-\s*YouTube$/, "") || null;
  const payload = { v: __VERSION__, id, title, author, source, lang, segs: segs || [] };
  if (!segs) say("couldn't get this video's transcript. Opening it anyway; notes will be tidied without it.");
  else say("opening NoteSmith…");

  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const gz = new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip")));
  const buf = new Uint8Array(await gz.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  const b64 = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  if (!segs) await sleep(2500);
  location.href = APP + "${IMPORT_PREFIX}" + b64;
})()`;

/** The bookmark's code for a NoteSmith at `appUrl` (its full address, ending in "/"). */
export function bookmarkletCode(appUrl: string): string {
  return SOURCE.replace("__APP__", appUrl.replace(/"/g, "%22")).replace("__VERSION__", String(IMPORT_VERSION));
}

/** The bookmark as a `javascript:` URL, ready to drag to the bookmarks bar. */
export function bookmarkletHref(appUrl: string): string {
  return "javascript:" + encodeURIComponent(bookmarkletCode(appUrl));
}

export interface ImportedVideo {
  id: string;
  title: string | null;
  author: string | null;
  /** "uploaded" (by the creator), "auto" (auto-generated), "panel" (read from the transcript panel), or null. */
  source: string | null;
  segments: Array<{ start: number; end: number; text: string }>;
}

/** Read what the bookmark put in the URL hash. Returns null for anything else. */
export async function readImport(hash: string): Promise<ImportedVideo | null> {
  if (!hash.startsWith(IMPORT_PREFIX)) return null;
  try {
    const b64 = hash.slice(IMPORT_PREFIX.length).replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const text = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
    const data = JSON.parse(text) as {
      v: number;
      id: string;
      title: string | null;
      author: string | null;
      source: string | null;
      segs: Array<[number, number, string]>;
    };
    if (!/^[\w-]{11}$/.test(data.id ?? "")) return null;
    const segments = (Array.isArray(data.segs) ? data.segs : [])
      .filter((s) => Array.isArray(s) && typeof s[0] === "number" && typeof s[2] === "string")
      .map(([start, end, text]) => ({ start, end: typeof end === "number" ? end : start, text: String(text).slice(0, 2000) }));
    return {
      id: data.id,
      title: typeof data.title === "string" ? data.title.slice(0, 300) : null,
      author: typeof data.author === "string" ? data.author.slice(0, 200) : null,
      source: typeof data.source === "string" ? data.source : null,
      segments,
    };
  } catch {
    return null;
  }
}
