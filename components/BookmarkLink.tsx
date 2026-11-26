"use client";

import { useEffect, useRef, useState } from "react";
import { bookmarkletHref } from "@/lib/bookmarklet";
import { HammerIcon } from "./icons";

/**
 * The "NoteSmith" bookmark, to drag to the bookmarks bar. Its href is set
 * after mount because React refuses to render javascript: URLs.
 */
export function BookmarkLink({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    const app = window.location.origin + window.location.pathname;
    ref.current?.setAttribute("href", bookmarkletHref(app));
  }, []);

  return (
    <span className={`inline-flex flex-col items-start gap-1 ${className}`}>
      <a
        ref={ref}
        draggable
        onClick={(e) => {
          e.preventDefault();
          setHint(true);
        }}
        className="btn btn-primary h-9 cursor-grab px-3 active:cursor-grabbing"
        title="Drag this to your bookmarks bar"
      >
        <HammerIcon size={16} />
        NoteSmith
      </a>
      <span className={`text-caption ${hint ? "text-accent" : "text-faint"}`}>
        {hint
          ? "Drag it to your bookmarks bar instead of clicking it here."
          : "Drag this button to your bookmarks bar (Ctrl+Shift+B shows the bar)."}
      </span>
    </span>
  );
}
