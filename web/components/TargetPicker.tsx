"use client";

import { useState } from "react";
import { normalizeHandle } from "@/lib/engine/handle";

interface TargetPickerProps {
  handles: string[];
  onHandles: (h: string[]) => void;
}

export default function TargetPicker({ handles, onHandles }: TargetPickerProps) {
  const [input, setInput] = useState("");

  function addHandle(raw: string) {
    const v = normalizeHandle(raw);
    if (!v || handles.includes(v)) return;
    onHandles([...handles, v]);
  }

  function removeHandle(h: string) {
    onHandles(handles.filter((x) => x !== h));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addHandle(input);
      setInput("");
    } else if (e.key === "Backspace" && input === "" && handles.length > 0) {
      onHandles(handles.slice(0, -1));
    }
  }

  return (
    <div className="space-y-5">
      {/* GitHub handles */}
      <div>
        <label className="block font-mono text-[10px] tracking-widest uppercase text-[var(--ink-muted)] mb-2">
          GitHub Handles to Analyze
        </label>
        <div className="flex flex-wrap gap-2 mb-3">
          {handles.map((h) => (
            <span
              key={h}
              className="inline-flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 bg-[var(--canvas-3)] border border-[var(--sage-dim)] text-[var(--sage-glow)]"
            >
              @{h}
              <button
                type="button"
                onClick={() => removeHandle(h)}
                className="text-[var(--sage-dim)] hover:text-[var(--sage-glow)] leading-none transition-colors"
                aria-label={`Remove @${h}`}
              >
                ✕
              </button>
            </span>
          ))}
          {handles.length === 0 && (
            <span className="font-mono text-xs text-[var(--ink-muted)]">
              No handles yet.
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="@username or github.com/username (Enter to add)"
            aria-label="Add GitHub handle"
            className="flex-1 bg-[var(--canvas-3)] border border-[var(--rule-bright)] text-[var(--ink)] font-mono text-xs px-3 py-1.5 placeholder-[var(--ink-muted)] focus:outline-none focus:border-[var(--sage-dim)] transition-colors duration-150"
          />
          <button
            type="button"
            onClick={() => { addHandle(input); setInput(""); }}
            className="font-mono text-xs px-3 py-1.5 border border-[var(--rule-bright)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:border-[var(--sage-dim)] transition-colors duration-150"
          >
            add
          </button>
        </div>
      </div>
    </div>
  );
}
