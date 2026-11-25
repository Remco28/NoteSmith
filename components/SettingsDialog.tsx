"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_MODELS } from "@/lib/storage";
import type { Provider, Settings } from "@/types/notesmith";
import { EyeIcon, EyeOffIcon, XIcon } from "./icons";

const PROVIDERS: Array<{ id: Provider; name: string; keyHint: string; keyUrl: string; models: string[] }> = [
  {
    id: "anthropic",
    name: "Anthropic",
    keyHint: "sk-ant-…",
    keyUrl: "https://console.anthropic.com/settings/keys",
    models: ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"],
  },
  {
    id: "openai",
    name: "OpenAI",
    keyHint: "sk-…",
    keyUrl: "https://platform.openai.com/api-keys",
    models: ["gpt-5.4-nano", "gpt-5.4-mini", "gpt-5.4"],
  },
];

export function SettingsDialog({
  open,
  settings,
  serverKey,
  onSave,
  onClose,
}: {
  open: boolean;
  settings: Settings;
  serverKey: Record<Provider, boolean>;
  onSave: (s: Settings) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(settings);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setDraft(settings);
      setShowKey(false);
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open, settings]);

  const p = PROVIDERS.find((x) => x.id === draft.provider)!;
  const key = draft.apiKeys[draft.provider];
  const model = draft.models[draft.provider];
  const needsKey = !key.trim() && !serverKey[draft.provider];

  const save = () => {
    onSave({
      ...draft,
      models: { ...draft.models, [draft.provider]: model.trim() || DEFAULT_MODELS[draft.provider] },
      apiKeys: { ...draft.apiKeys, [draft.provider]: key.trim() },
    });
    onClose();
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="w-[440px] max-w-[calc(100vw-32px)] rounded-md border border-border-strong bg-surface p-0 text-ink shadow-2xl shadow-black/50 backdrop:bg-black/60"
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <header className="flex items-center border-b border-border px-4 py-3">
          <h2 className="text-title font-semibold">Settings</h2>
          <div className="flex-1" />
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close settings">
            <XIcon size={16} />
          </button>
        </header>

        <div className="space-y-5 px-4 py-4">
          <fieldset>
            <legend className="mb-1.5 text-caption font-medium text-muted">AI provider</legend>
            <div className="grid grid-cols-2 gap-1 rounded-sm border border-border bg-sunken p-1">
              {PROVIDERS.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  aria-pressed={draft.provider === x.id}
                  onClick={() => setDraft({ ...draft, provider: x.id })}
                  className={`h-7 rounded-[4px] text-body transition-colors ${
                    draft.provider === x.id ? "bg-raised font-medium text-ink shadow-sm" : "text-muted hover:text-ink"
                  }`}
                  style={{ transitionDuration: "var(--duration)" }}
                >
                  {x.name}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="api-key" className="mb-1.5 block text-caption font-medium text-muted">
              {p.name} API key
            </label>
            <div className="relative">
              <input
                id="api-key"
                type={showKey ? "text" : "password"}
                autoComplete="off"
                spellCheck={false}
                value={key}
                placeholder={serverKey[draft.provider] ? "Optional: this server has its own key" : p.keyHint}
                onChange={(e) => setDraft({ ...draft, apiKeys: { ...draft.apiKeys, [draft.provider]: e.target.value } })}
                className="field pr-9 font-mono"
              />
              <button
                type="button"
                className="btn-icon absolute right-0 top-0"
                onClick={() => setShowKey((v) => !v)}
                aria-label={showKey ? "Hide key" : "Show key"}
                title={showKey ? "Hide key" : "Show key"}
              >
                {showKey ? <EyeOffIcon size={15} /> : <EyeIcon size={15} />}
              </button>
            </div>
            <p className="mt-1.5 text-caption text-faint">
              Kept only in this browser. It&apos;s sent to {p.name} through this NoteSmith server with each forge
              request, and never stored there. Clear the field and save to remove it.{" "}
              <a href={p.keyUrl} target="_blank" rel="noreferrer" className="text-muted underline hover:text-ink">
                Get a key
              </a>
            </p>
          </div>

          <div>
            <label htmlFor="model" className="mb-1.5 block text-caption font-medium text-muted">
              Model
            </label>
            <input
              id="model"
              list="model-options"
              spellCheck={false}
              value={model}
              placeholder={DEFAULT_MODELS[draft.provider]}
              onChange={(e) => setDraft({ ...draft, models: { ...draft.models, [draft.provider]: e.target.value } })}
              className="field font-mono"
            />
            <datalist id="model-options">
              {p.models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <p className="mt-1.5 text-caption text-faint">
              Any {p.name} model id. Refining is light work, so a small, fast model is enough.
            </p>
          </div>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={draft.autoForge}
              onChange={(e) => setDraft({ ...draft, autoForge: e.target.checked })}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--accent)]"
            />
            <span>
              <span className="block text-body text-ink">Forge automatically</span>
              <span className="block text-caption text-faint">
                Refine new scribbles a few seconds after you stop adding them.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={draft.showContext}
              onChange={(e) => setDraft({ ...draft, showContext: e.target.checked })}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--accent)]"
            />
            <span>
              <span className="block text-body text-ink">Show what pointing scribbles refer to</span>
              <span className="block text-caption text-faint">
                For a scribble like &ldquo;lol that&rdquo;, show what was being said, taken from the transcript and
                marked as such: (re: …). Your own words are never changed.
              </span>
            </span>
          </label>
        </div>

        <footer className="flex items-center gap-2 border-t border-border px-4 py-3">
          {needsKey && <span className="text-caption text-accent">Add a key to start forging.</span>}
          <div className="flex-1" />
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Save
          </button>
        </footer>
      </form>
    </dialog>
  );
}
