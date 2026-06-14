"use client";

import { useState } from "react";

interface BaselinePanelProps {
  tools: string[];
  methods?: string[];
}

export default function BaselinePanel({ tools }: BaselinePanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-[var(--rule-bright)] mb-8">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-[var(--canvas-3)] transition-colors duration-150 group"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-[var(--ink-muted)] tracking-widest uppercase">
            Baseline
          </span>
          <span className="font-mono text-xs text-[var(--ink-muted)]">
            {tools.length} tools known
          </span>
        </div>
        <span
          className={[
            "font-mono text-[var(--ink-muted)] text-sm transition-transform duration-200",
            open ? "rotate-90" : "",
          ].join(" ")}
        >
          ▶
        </span>
      </button>

      {open && (
        <div className="expand-panel border-t border-[var(--rule)] px-5 py-4">
          <div className="flex flex-wrap gap-2">
            {tools.map((tool) => (
              <span
                key={tool}
                className="font-mono text-xs px-2.5 py-1 bg-[var(--canvas-3)] border border-[var(--rule-bright)] text-[var(--ink-dim)]"
              >
                {tool}
              </span>
            ))}
          </div>
          {tools.length === 0 && (
            <span className="font-mono text-xs text-[var(--ink-muted)]">
              No baseline tools recorded.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
