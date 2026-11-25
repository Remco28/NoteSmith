"use client";

import { useCallback, useRef, useState } from "react";
import { UndoIcon } from "./icons";

export interface Toast {
  id: number;
  text: string;
  tone?: "info" | "error";
  action?: { label: string; run: () => void };
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const show = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = next.current++;
      setToasts((t) => [...t.slice(-2), { ...toast, id }]);
      setTimeout(() => dismiss(id), toast.action ? 10000 : 3500);
    },
    [dismiss],
  );

  return { toasts, show, dismiss };
}

export function Toasts({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`fade-in pointer-events-auto flex items-center gap-3 rounded-md border px-3 py-2 text-body shadow-xl shadow-black/40 ${
            t.tone === "error" ? "border-danger bg-raised text-ink" : "border-border-strong bg-raised text-ink"
          }`}
          role={t.tone === "error" ? "alert" : "status"}
        >
          <span>{t.text}</span>
          {t.action && (
            <button
              type="button"
              title={`${t.action.label} (Ctrl+Z)`}
              className="btn btn-secondary h-7 px-2"
              onClick={() => {
                t.action!.run();
                dismiss(t.id);
              }}
            >
              <UndoIcon size={14} />
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
