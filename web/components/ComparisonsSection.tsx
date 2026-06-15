"use client";

import type { Comparison } from "@/lib/result-types";

interface Props {
  comparisons: Comparison[];
}

export default function ComparisonsSection({ comparisons }: Props) {
  if (comparisons.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="font-mono text-[11px] tracking-widest uppercase text-[var(--ink-muted)]">
          You vs. them
        </span>
        <span className="flex-1 h-px bg-[var(--rule)]" />
        <span className="font-mono text-[11px] text-[var(--ink-muted)]">
          {comparisons.length} profile{comparisons.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-4">
        {comparisons.map((c, i) => (
          <div
            key={i}
            className="border border-[var(--rule-bright)] bg-[var(--canvas-2)]"
          >
            {/* Amber top accent */}
            <div className="h-px bg-gradient-to-r from-[var(--amber)] via-[var(--amber-dim)] to-transparent" />

            <div className="px-5 py-4 space-y-4">
              {/* Header: handle + signal chip */}
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={`https://github.com/${c.handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm font-medium text-[var(--ink)] hover:text-[var(--amber)] transition-colors duration-150"
                >
                  @{c.handle}
                </a>
                <span className="font-mono text-[11px] px-2 py-0.5 border border-[var(--amber-dim)] text-[var(--amber)] tracking-wide">
                  {c.theirSignal}
                </span>
              </div>

              {/* Two-column skill comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* They have, you don't */}
                {c.theyHaveYouDont.length > 0 && (
                  <div>
                    <span className="font-mono text-[10px] tracking-widest uppercase text-[var(--ink-muted)] block mb-2">
                      They have, you don&apos;t
                    </span>
                    <ul className="space-y-1">
                      {c.theyHaveYouDont.map((item, j) => (
                        <li key={j} className="font-mono text-xs text-[var(--ink-dim)] flex items-start gap-2">
                          <span className="text-[var(--sage-glow)] flex-none">–</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* You have, they don't */}
                {c.youHaveTheyDont.length > 0 && (
                  <div>
                    <span className="font-mono text-[10px] tracking-widest uppercase text-[var(--ink-muted)] block mb-2">
                      You have, they don&apos;t
                    </span>
                    <ul className="space-y-1">
                      {c.youHaveTheyDont.map((item, j) => (
                        <li key={j} className="font-mono text-xs text-[var(--ink-dim)] flex items-start gap-2">
                          <span className="text-[var(--amber)] flex-none">+</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Shared */}
              {c.shared.length > 0 && (
                <div>
                  <span className="font-mono text-[10px] tracking-widest uppercase text-[var(--ink-muted)] block mb-2">
                    Shared
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {c.shared.map((item, j) => (
                      <span
                        key={j}
                        className="font-mono text-[11px] px-2 py-0.5 border border-[var(--rule-bright)] text-[var(--ink-dim)] tracking-wide"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Notable projects */}
              {c.notableProjects.length > 0 && (
                <div>
                  <span className="font-mono text-[10px] tracking-widest uppercase text-[var(--ink-muted)] block mb-2">
                    Notable projects
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {c.notableProjects.map((proj, j) => (
                      <span
                        key={j}
                        className="font-mono text-[11px] px-2 py-0.5 border border-[var(--sage-dim)] text-[var(--sage-glow)] bg-[var(--sage-dim)]/10 tracking-wide"
                      >
                        {proj}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Takeaway */}
              <p className="font-serif text-xs text-[var(--ink-dim)] leading-relaxed italic border-t border-[var(--rule)] pt-3">
                {c.takeaway}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
