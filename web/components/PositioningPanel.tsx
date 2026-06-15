"use client";

import { useState } from "react";
import type { Positioning } from "@/lib/result-types";

interface Props {
  positioning: Positioning;
}

export default function PositioningPanel({ positioning }: Props) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  return (
    <div className="border border-[var(--amber-dim)] bg-[var(--canvas-2)]">
      {/* Header rule */}
      <div className="h-px bg-gradient-to-r from-[var(--amber)] via-[var(--amber-dim)] to-transparent" />

      <div className="px-5 py-5 space-y-5">
        {/* Label */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] tracking-widest uppercase text-[var(--amber)]">
            Positioning read
          </span>
          <span className="flex-1 h-px bg-[var(--amber-dim)]/30" />
        </div>

        {/* Signal arrow: current → target */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="border border-[var(--rule-bright)] bg-[var(--canvas-3)] px-4 py-3">
            <div className="font-mono text-[10px] tracking-widest uppercase text-[var(--ink-muted)] mb-1.5">
              Current signal
            </div>
            <div className="font-serif text-sm text-[var(--ink-dim)] italic leading-snug">
              {positioning.currentSignal}
            </div>
          </div>

          <div className="flex flex-col items-center gap-1 flex-none">
            <span className="font-mono text-[var(--amber-dim)] text-base leading-none">→</span>
          </div>

          <div className="border border-[var(--sage-dim)] bg-[var(--canvas-3)] px-4 py-3">
            <div className="font-mono text-[10px] tracking-widest uppercase text-[var(--sage)] mb-1.5">
              Target signal
            </div>
            <div className="font-serif text-sm text-[var(--ink)] italic leading-snug">
              {positioning.targetSignal}
            </div>
          </div>
        </div>

        {/* Gap */}
        <div className="border-l-2 border-[var(--amber-dim)] pl-4">
          <div className="font-mono text-[10px] tracking-widest uppercase text-[var(--ink-muted)] mb-1.5">
            The gap
          </div>
          <p className="font-serif text-sm text-[var(--ink-dim)] leading-relaxed italic">
            {positioning.gap}
          </p>
        </div>

        {/* Moves */}
        {positioning.moves.length > 0 && (
          <div>
            <div className="font-mono text-[10px] tracking-widest uppercase text-[var(--ink-muted)] mb-3">
              Moves ({positioning.moves.length})
            </div>
            <ol className="space-y-2">
              {positioning.moves.map((move, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span className="font-mono text-[10px] text-[var(--amber-dim)] w-4 flex-none mt-0.5 leading-tight">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-sans text-xs text-[var(--ink)] leading-relaxed">
                    {move}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Evidence (collapsible) */}
        {positioning.evidence.length > 0 && (
          <div>
            <button
              onClick={() => setEvidenceOpen((o) => !o)}
              className="flex items-center gap-2 group"
              aria-expanded={evidenceOpen}
            >
              <span className="font-mono text-[10px] tracking-widest uppercase text-[var(--ink-muted)] group-hover:text-[var(--ink-dim)] transition-colors duration-150">
                Evidence
              </span>
              <span className="font-mono text-[10px] text-[var(--ink-muted)]">
                ({positioning.evidence.length})
              </span>
              <span
                className={[
                  "font-mono text-[var(--ink-muted)] text-[9px] transition-transform duration-200",
                  evidenceOpen ? "rotate-90" : "",
                ].join(" ")}
              >
                ▶
              </span>
            </button>
            {evidenceOpen && (
              <div className="expand-panel mt-2 space-y-1.5 pl-0">
                {positioning.evidence.map((ev, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="font-mono text-[var(--ink-muted)] text-[10px] mt-0.5 flex-none">◦</span>
                    <span className="font-mono text-xs text-[var(--ink-dim)] leading-snug">{ev}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
