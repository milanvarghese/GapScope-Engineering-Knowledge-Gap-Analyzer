"use client";

import { useState } from "react";
import type { PathStep, Concept } from "@/lib/result-types";

interface Props {
  learningPath: PathStep[];
  concepts: Concept[];
}

function conceptName(conceptId: string, concepts: Concept[]): string {
  return concepts.find((c) => c.id === conceptId)?.name ?? conceptId;
}

export default function LearningPath({ learningPath, concepts }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  if (learningPath.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="font-mono text-[11px] tracking-widest uppercase text-[var(--ink-muted)]">
          Learning path
        </span>
        <span className="flex-1 h-px bg-[var(--rule)]" />
        <span className="font-mono text-[11px] text-[var(--ink-muted)]">
          {learningPath.length} step{learningPath.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-0 border border-[var(--rule-bright)]">
        {learningPath.map((step, i) => {
          const isOpen = openIdx === i;
          const name = conceptName(step.conceptId, concepts);
          const concept = concepts.find((c) => c.id === step.conceptId);
          const verifiedResources = step.resources.filter((r) => r.verified);

          return (
            <div
              key={step.conceptId}
              className={[
                "gap-row-enter border-b border-[var(--rule)] last:border-b-0",
              ].join(" ")}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* Row header */}
              <button
                onClick={() => setOpenIdx(isOpen ? null : i)}
                className={[
                  "w-full flex items-stretch text-left transition-colors duration-150",
                  "cursor-pointer hover:bg-[var(--canvas-3)]",
                  isOpen ? "bg-[var(--canvas-3)]" : "",
                ].join(" ")}
                aria-expanded={isOpen}
              >
                {/* Rank */}
                <span className="w-10 flex-none flex items-center justify-center font-mono text-xs text-[var(--ink-muted)] border-r border-[var(--rule)] py-3.5">
                  {step.rank}
                </span>

                {/* Stage accent bar */}
                <span
                  className={[
                    "w-1 flex-none",
                    concept?.stage === "current-frontier"
                      ? "bg-[var(--amber-dim)]"
                      : concept?.stage === "emerging"
                      ? "bg-[var(--sage-dim)]"
                      : "bg-[var(--rule-bright)]",
                  ].join(" ")}
                />

                {/* Name + whyNow */}
                <span className="flex-1 flex flex-col sm:flex-row sm:items-center gap-1.5 px-4 py-3.5 min-w-0">
                  <span className="font-mono text-sm text-[var(--ink)] font-medium tracking-tight truncate">
                    {name}
                  </span>
                  <span className="font-sans text-xs text-[var(--ink-muted)] leading-snug sm:ml-2 truncate">
                    {step.whyNow}
                  </span>
                </span>

                {/* Resources count */}
                {verifiedResources.length > 0 && (
                  <span className="hidden sm:flex w-24 flex-none flex-col items-end justify-center px-4 py-3.5 border-l border-[var(--rule)]">
                    <span className="font-mono text-[11px] text-[var(--ink-muted)] tracking-widest uppercase">
                      Links
                    </span>
                    <span className="font-mono text-xs text-[var(--ink-dim)]">
                      {verifiedResources.length}
                    </span>
                  </span>
                )}

                {/* Chevron */}
                <span className="w-10 flex-none flex items-center justify-center border-l border-[var(--rule)] py-3.5">
                  <span
                    className={[
                      "font-mono text-[var(--ink-muted)] text-[11px] transition-transform duration-200",
                      isOpen ? "rotate-90" : "",
                    ].join(" ")}
                  >
                    ▶
                  </span>
                </span>
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div className="expand-panel border-t border-[var(--rule)] bg-[var(--canvas-2)] border-l-2 border-l-[var(--amber-dim)]">
                  <div className="px-6 py-5 space-y-5">
                    {/* What to learn */}
                    <div>
                      <h3 className="font-mono text-[11px] tracking-widest uppercase text-[var(--ink-muted)] mb-2">
                        What to learn
                      </h3>
                      <p className="font-serif text-sm text-[var(--ink-dim)] leading-relaxed italic max-w-3xl">
                        {step.whatToLearn}
                      </p>
                    </div>

                    {/* Project */}
                    <div>
                      <h3 className="font-mono text-[11px] tracking-widest uppercase text-[var(--ink-muted)] mb-2">
                        Build
                      </h3>
                      <div className="flex gap-2 items-start">
                        <span className="font-mono text-[var(--amber-dim)] text-xs flex-none mt-0.5">◆</span>
                        <p className="font-sans text-xs text-[var(--ink)] leading-relaxed">
                          {step.project}
                        </p>
                      </div>
                    </div>

                    {/* Resources */}
                    {verifiedResources.length > 0 && (
                      <div>
                        <h3 className="font-mono text-[11px] tracking-widest uppercase text-[var(--ink-muted)] mb-2">
                          Resources ({verifiedResources.length} verified)
                        </h3>
                        <ul className="space-y-1.5">
                          {verifiedResources.map((r, j) => (
                            <li key={j}>
                              <a
                                href={r.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-xs text-[var(--amber-dim)] hover:text-[var(--amber-glow)] underline underline-offset-2 decoration-dotted hover:decoration-solid transition-colors duration-150"
                              >
                                {r.title} ↗
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
