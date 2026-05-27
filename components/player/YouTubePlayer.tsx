"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface YouTubePlayerProps {
  videoId: string;
  onReady?: () => void;
  onTimeUpdate?: (time: number) => void;
  onError?: (error: string) => void;
}

// YT namespace types - matches @types/youtube
interface YouTubePlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  getCurrentTime: () => number;
  destroy: () => void;
  setSize: (width: number, height: number) => void;
}

declare const YT: {
  Player: new (
    elementId: string,
    config: {
      videoId: string;
      playerVars?: {
        autoplay?: number;
        rel?: number;
        showinfo?: number;
        modestbranding?: number;
      };
      events: {
        onReady?: () => void;
        onStateChange?: (event: { data: number }) => void;
        onError?: () => void;
      };
    }
  ) => YouTubePlayerInstance;
  PlayerState: {
    UNSTARTED: number;
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
};

declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }
}

/**
 * YouTube player wrapper that exposes playback time, pause method, and ready state.
 * Does not auto-play by default.
 */
export function YouTubePlayer({ videoId, onReady, onTimeUpdate, onError }: YouTubePlayerProps) {
  const playerShellRef = useRef<HTMLDivElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const timeUpdateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoIdRef = useRef(videoId);

  const resizePlayer = useCallback(() => {
    const shell = playerShellRef.current;
    const container = playerContainerRef.current;
    const player = playerRef.current;
    if (!shell || !container || !player) return;

    const availableWidth = shell.clientWidth;
    const availableHeight = shell.clientHeight;
    if (!availableWidth || !availableHeight) return;

    const widthFromHeight = availableHeight * (16 / 9);
    const targetWidth = Math.min(availableWidth, widthFromHeight);
    const targetHeight = targetWidth * (9 / 16);

    container.style.width = `${targetWidth}px`;
    container.style.height = `${targetHeight}px`;
    player.setSize(targetWidth, targetHeight);
  }, []);

  // Keep videoId ref updated
  useEffect(() => {
    videoIdRef.current = videoId;
  }, [videoId]);

  // Load YouTube IFrame API if not already loaded
  useEffect(() => {
    if (typeof window !== "undefined" && !window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // Initialize player when videoId changes or container is ready
  useEffect(() => {
    if (!videoId || !playerContainerRef.current) return;

    const containerId = `youtube-player-${videoId}-${Date.now()}`;
    playerContainerRef.current.id = containerId;

    const initPlayer = () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }

      const player = new window.YT.Player(containerId, {
        videoId,
        playerVars: {
          autoplay: 0, // Do not auto-play
          rel: 0,
          showinfo: 0,
          modestbranding: 1,
        },
        events: {
          onReady: () => {
            setIsReady(true);
            resizePlayer();
            onReady?.();
          },
          onStateChange: (event: { data: number }) => {
            const playerState = event.data;
            if (playerState === window.YT.PlayerState.PLAYING) {
              startTimeUpdates();
            } else {
              stopTimeUpdates();
            }
            if (
              playerState === window.YT.PlayerState.PAUSED ||
              playerState === window.YT.PlayerState.BUFFERING
            ) {
              stopTimeUpdates();
            }
          },
          onError: () => {
            setIsReady(false);
            onError?.("Failed to load YouTube video");
          },
        },
      });

      playerRef.current = player;
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      stopTimeUpdates();
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      setIsReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  useEffect(() => {
    const shell = playerShellRef.current;
    if (!shell || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      resizePlayer();
    });

    observer.observe(shell);

    return () => {
      observer.disconnect();
    };
  }, [resizePlayer]);

  const startTimeUpdates = useCallback(() => {
    if (timeUpdateIntervalRef.current) return;

    timeUpdateIntervalRef.current = setInterval(() => {
      if (playerRef.current && videoIdRef.current === videoId) {
        const time = playerRef.current.getCurrentTime?.() ?? 0;
        setCurrentTime(time);
        onTimeUpdate?.(time);
      }
    }, 500);
  }, [onTimeUpdate, videoId]);

  const stopTimeUpdates = useCallback(() => {
    if (timeUpdateIntervalRef.current) {
      clearInterval(timeUpdateIntervalRef.current);
      timeUpdateIntervalRef.current = null;
    }
  }, []);

  // Expose pause method via window for voice recorder integration
  useEffect(() => {
    if (isReady && playerRef.current) {
      const pauseKey = `notesmith_pause_${videoId}`;
      (window as unknown as Record<string, () => void>)[pauseKey] = () => {
        playerRef.current?.pauseVideo?.();
      };
    }

    return () => {
      const pauseKey = `notesmith_pause_${videoId}`;
      delete (window as unknown as Record<string, unknown>)[pauseKey];
    };
  }, [isReady, videoId]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div
        ref={playerShellRef}
        className="flex min-h-[220px] flex-1 items-center justify-center overflow-hidden rounded-xl bg-black/95"
      >
        <div ref={playerContainerRef} className="max-h-full max-w-full" />
      </div>

      {!isReady && videoId && (
        <div className="text-sm text-gray-500">Loading player...</div>
      )}

      {isReady && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Playing</span>
          <span>{formatTime(currentTime)}</span>
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Export a helper to pause the player (for voice recorder integration)
export function pauseYouTubePlayer(videoId: string): void {
  const key = `notesmith_pause_${videoId}`;
  if (typeof window !== "undefined" && (window as unknown as Record<string, () => void>)[key]) {
    (window as unknown as Record<string, () => void>)[key]();
  }
}
