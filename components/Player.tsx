"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

/** What the rest of the app can ask of the video. */
export interface PlayerHandle {
  getTime(): number;
  seekTo(seconds: number): void;
  pause(): void;
  play(): void;
}

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getPlayerState(): number;
  setSize(w: number, h: number): void;
  destroy(): void;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement,
        opts: {
          videoId: string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: () => void;
            onStateChange?: (e: { data: number }) => void;
            onError?: (e: { data: number }) => void;
          };
        },
      ) => YTPlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;
function loadApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve();
      };
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    });
  }
  return apiPromise;
}

const PLAYING = 1;

interface PlayerProps {
  videoId: string;
  startAt?: number;
  onTime: (seconds: number) => void;
}

export const Player = forwardRef<PlayerHandle, PlayerProps>(function Player({ videoId, startAt = 0, onTime }, ref) {
  const wellRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onTimeRef = useRef(onTime);
  onTimeRef.current = onTime;

  const fit = useCallback(() => {
    const well = wellRef.current;
    const frame = frameRef.current;
    if (!well || !frame) return;
    const w = Math.min(well.clientWidth, (well.clientHeight * 16) / 9);
    const h = (w * 9) / 16;
    frame.style.width = `${w}px`;
    frame.style.height = `${h}px`;
    playerRef.current?.setSize?.(w, h);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      getTime: () => playerRef.current?.getCurrentTime?.() ?? 0,
      seekTo: (s) => {
        playerRef.current?.seekTo?.(Math.max(0, s), true);
        onTimeRef.current(Math.max(0, s));
      },
      pause: () => playerRef.current?.pauseVideo?.(),
      play: () => playerRef.current?.playVideo?.(),
    }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    setError(null);

    const frame = frameRef.current;
    const host = document.createElement("div");
    frame?.appendChild(host);

    loadApi().then(() => {
      if (cancelled || !window.YT) return;
      playerRef.current = new window.YT.Player(host, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, start: Math.floor(startAt) },
        events: {
          onReady: () => {
            fit();
            onTimeRef.current(startAt);
          },
          onStateChange: (e) => {
            if (timer) clearInterval(timer);
            timer = null;
            const t = playerRef.current?.getCurrentTime?.() ?? 0;
            onTimeRef.current(t);
            if (e.data === PLAYING) {
              timer = setInterval(() => onTimeRef.current(playerRef.current?.getCurrentTime?.() ?? 0), 250);
            }
          },
          onError: (e) => {
            setError(
              e.data === 101 || e.data === 150
                ? "The owner of this video doesn't allow it to be played outside YouTube."
                : "YouTube couldn't play this video.",
            );
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      playerRef.current?.destroy?.();
      playerRef.current = null;
      host.remove();
      frame?.replaceChildren();
    };
    // startAt only matters when a video first loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, fit]);

  useEffect(() => {
    const well = wellRef.current;
    if (!well) return;
    const observer = new ResizeObserver(fit);
    observer.observe(well);
    return () => observer.disconnect();
  }, [fit]);

  return (
    <div ref={wellRef} className="relative flex h-full min-h-0 w-full items-center justify-center bg-sunken">
      <div ref={frameRef} className="overflow-hidden [&_iframe]:block [&_iframe]:h-full [&_iframe]:w-full" />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-body text-muted">
          {error}
        </div>
      )}
    </div>
  );
});
