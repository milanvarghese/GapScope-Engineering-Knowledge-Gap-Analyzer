"use client";

import type { ProjectGap } from "@/lib/result-types";

interface Props {
  gaps: ProjectGap[];
}

export default function ProjectGaps({ gaps }: Props) {
  if (gaps.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="font-mono text-[11px] tracking-widest uppercase text-[var(--ink-muted)]">
          Project gaps
        </span>
        <span className="flex-1 h-px bg-[var(--rule)]" />
        <span className="font-mono text-[11px] text-[var(--ink-muted)]">
          {gaps.length} theme{gaps.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="border border-[var(--rule-bright)] divide-y divide-[var(--rule)]">
        {gaps.map((gap, i) => (
          <div
            key={i}
            className="gap-row-enter flex items-stretch"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            {/* Sage accent */}
            <span className="w-1 flex-none bg-[var(--sage-dim)]" />

            <div className="flex-1 px-4 py-4 space-y-2">
              {/* Theme */}
              <div className="font-mono text-xs text-[var(--ink)] font-medium tracking-tight">
                {gap.theme}
              </div>

              {/* Suggestion */}
              <p className="font-sans text-xs text-[var(--ink-dim)] leading-relaxed">
                {gap.suggestion}
              </p>

              {/* Seen in */}
              {gap.seenIn.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {gap.seenIn.map((handle, j) => (
                    <span
                      key={j}
                      className="font-mono text-[11px] px-2 py-0.5 border border-[var(--sage-dim)] text-[var(--sage-glow)] bg-[var(--sage-dim)]/10 tracking-wide"
                    >
                      {handle}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
