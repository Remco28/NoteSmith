"use client";

import { useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { ScribbleEntry } from "@/types/notesmith";
import { formatSeconds } from "@/lib/utils/time";

interface ScribbleEntryCardProps {
  entry: ScribbleEntry;
  onTextChange: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  compact?: boolean;
}

export function ScribbleEntryCard({
  entry,
  onTextChange,
  onDelete,
  compact = false,
}: ScribbleEntryCardProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Write a note...",
      }),
    ],
    content: entry.text,
    onUpdate: ({ editor }) => {
      onTextChange(entry.id, editor.getText());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[1rem]",
      },
    },
  });

  const handleDelete = useCallback(() => {
    onDelete(entry.id);
  }, [entry.id, onDelete]);

  return (
    <div className="group relative border border-gray-200 rounded-lg p-3 bg-white hover:border-gray-300 transition-colors">
      <div className="flex items-start gap-3">
        {!compact && (
          <div className="shrink-0">
            <span className="text-xs font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
              {formatSeconds(entry.timestamp)}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <EditorContent editor={editor} />
        </div>
        <button
          onClick={handleDelete}
          className="shrink-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all p-1 rounded hover:bg-red-50"
          title="Delete scribble"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </button>
      </div>
    </div>
  );
}