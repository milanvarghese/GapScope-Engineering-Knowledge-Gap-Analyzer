"use client";

import { useState, useEffect, useRef } from "react";
import type { Gap } from "@/lib/types";
import { fetchStudy } from "@/lib/client";
import type { StudyCard } from "@/lib/client";

interface GapRowProps {
  gap: Gap;
  rank: number;
  animationDelay: number;
}

export default function GapRow({ gap, rank, animationDelay }: GapRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [study, setStudy] = useState<StudyCard | null>(null);
  const [studying, setStudying] = useState(false);
  const fetchedRef = useRef(false);

  const isToolKind = gap.kind === "tool";

  // Merge static docs with study docs (deduplicate by url)
  const allDocs = study
    ? [
        ...gap.docs,
        ...study.docs.filter((d) => !gap.docs.some((x) => x.url === d.url)),
      ]
    : gap.docs;
  const verifiedDocs = allDocs.filter((d) => d.verified);

  const effectiveProjects = study
    ? {
        small: [...gap.projects.small, ...study.projects.small],
        big: [...gap.projects.big, ...study.projects.big],
      }
    : gap.projects;

  const hasProjects =
    effectiveProjects.small.length > 0 || effectiveProjects.big.length > 0;
  const hasContent =
    gap.research.researched ||
    gap.evidence.length > 0 ||
    verifiedDocs.length > 0 ||
    hasProjects ||
    true; // always expandable to trigger study fetch

  // When expanded and no summary yet, fetch study once
  useEffect(() => {
    if (!expanded) return;
    if (gap.research?.summary) return; // already have it
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    setStudying(true);
    fetchStudy(gap.id)
      .then((card) => setStudy(card))
      .catch(() => { /* silently ignore study errors */ })
      .finally(() => setStudying(false));
  }, [expanded, gap.id, gap.research?.summary]);

  const scorePercent = Math.round(gap.rankScore * 100);

  return (
    <div
      className="gap-row-enter border-b border-[var(--rule)] last:border-b-0"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Main row */}
      <button
        onClick={() => setExpanded((e) => !e)}
        disabled={!hasContent}
        className={[
          "w-full flex items-stretch text-left transition-colors duration-150",
          hasContent ? "cursor-pointer hover:bg-[var(--canvas-3)]" : "cursor-default",
          expanded ? "bg-[var(--canvas-3)]" : "",
        ].join(" ")}
        aria-expanded={expanded}
      >
        {/* Rank gutter */}
        <span className="w-10 flex-none flex items-center justify-center font-mono text-xs text-[var(--ink-muted)] border-r border-[var(--rule)] py-3.5">
          {rank}
        </span>

        {/* Kind accent bar */}
        <span
          className={[
            "w-1 flex-none",
            isToolKind ? "bg-[var(--amber-dim)]" : "bg-[var(--sage-dim)]",
          ].join(" ")}
        />

        {/* Name + badge */}
        <span className="flex-1 flex flex-col sm:flex-row sm:items-center gap-1.5 px-4 py-3.5 min-w-0">
          <span className="font-mono text-sm text-[var(--ink)] font-medium tracking-tight truncate">
            {gap.name}
          </span>
          <span
            className={[
              "inline-flex items-center px-2 py-0.5 text-[10px] font-mono tracking-widest uppercase border w-fit",
              isToolKind
                ? "border-[var(--amber-dim)] text-[var(--amber)] bg-[var(--amber-dim)]/10"
                : "border-[var(--sage-dim)] text-[var(--sage-glow)] bg-[var(--sage-dim)]/10",
            ].join(" ")}
          >
            {gap.kind}
          </span>
        </span>

        {/* Frequency */}
        <span className="hidden sm:flex w-20 flex-none flex-col items-end justify-center px-4 py-3.5 border-l border-[var(--rule)]">
          <span className="font-mono text-xs text-[var(--ink-muted)] tracking-widest uppercase leading-tight">
            Freq
          </span>
          <span className="font-mono text-sm text-[var(--ink-dim)]">{gap.frequency}</span>
        </span>

        {/* Rank score bar */}
        <span className="hidden sm:flex w-36 flex-none flex-col justify-center px-4 py-3.5 border-l border-[var(--rule)] gap-1">
          <span className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-[var(--ink-muted)] tracking-widest uppercase">
              Score
            </span>
            <span className="font-mono text-[10px] text-[var(--ink-dim)]">
              {scorePercent}
            </span>
          </span>
          <span className="relative h-1 bg-[var(--canvas-4)] border border-[var(--rule)] overflow-hidden">
            <span
              className={[
                "absolute top-0 left-0 h-full score-bar-fill",
                isToolKind ? "bg-[var(--amber)]" : "bg-[var(--sage)]",
              ].join(" ")}
              style={
                {
                  "--score-width": `${scorePercent}%`,
                  "--animation-delay": `${animationDelay + 200}ms`,
                } as React.CSSProperties
              }
            />
          </span>
          {/* Tick marks */}
          <span className="flex justify-between">
            {[0, 25, 50, 75, 100].map((t) => (
              <span key={t} className="w-px h-1 bg-[var(--rule-bright)]" />
            ))}
          </span>
        </span>

        {/* Expand chevron */}
        {hasContent && (
          <span className="w-10 flex-none flex items-center justify-center border-l border-[var(--rule)] py-3.5">
            <span
              className={[
                "font-mono text-[var(--ink-muted)] text-[10px] transition-transform duration-200",
                expanded ? "rotate-90" : "",
              ].join(" ")}
            >
              ▶
            </span>
          </span>
        )}
      </button>

      {/* Expanded detail panel */}
      {expanded && (
        <div
          className={[
            "expand-panel border-t border-[var(--rule)] bg-[var(--canvas-2)]",
            "border-l-2",
            isToolKind ? "border-l-[var(--amber-dim)]" : "border-l-[var(--sage-dim)]",
          ].join(" ")}
        >
          <div className="px-6 py-5 space-y-5">
            {/* Researching indicator */}
            {studying && (
              <span className="font-mono text-[10px] tracking-widest uppercase text-[var(--ink-muted)] animate-pulse">
                researching…
              </span>
            )}

            {/* Summary — from gap.research if present, else from study card */}
            {(() => {
              const summary = gap.research?.summary ?? study?.summary;
              if (!summary) return null;
              return (
                <div>
                  <h3 className="font-mono text-[10px] tracking-widest uppercase text-[var(--ink-muted)] mb-2">
                    Summary
                  </h3>
                  <p className="font-serif text-sm text-[var(--ink-dim)] leading-relaxed italic max-w-3xl">
                    {summary}
                  </p>
                </div>
              );
            })()}

            {/* Grid: evidence + docs */}
            {(gap.evidence.length > 0 || verifiedDocs.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Evidence */}
                {gap.evidence.length > 0 && (
                  <div>
                    <h3 className="font-mono text-[10px] tracking-widest uppercase text-[var(--ink-muted)] mb-2">
                      Evidence ({gap.evidence.length})
                    </h3>
                    <ul className="space-y-1.5">
                      {gap.evidence.map((ev, i) => (
                        <li key={i} className="flex flex-col gap-0.5">
                          <span className="font-mono text-xs text-[var(--amber)]">
                            {ev.repo}
                          </span>
                          <span className="font-sans text-xs text-[var(--ink-muted)] leading-snug">
                            {ev.signal}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Verified docs */}
                {verifiedDocs.length > 0 && (
                  <div>
                    <h3 className="font-mono text-[10px] tracking-widest uppercase text-[var(--ink-muted)] mb-2">
                      Docs ({verifiedDocs.length} verified)
                    </h3>
                    <ul className="space-y-1.5">
                      {verifiedDocs.map((doc, i) => (
                        <li key={i}>
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className={[
                              "font-mono text-xs underline underline-offset-2 decoration-dotted hover:decoration-solid transition-colors",
                              isToolKind
                                ? "text-[var(--amber-dim)] hover:text-[var(--amber-glow)]"
                                : "text-[var(--sage-dim)] hover:text-[var(--sage-glow)]",
                            ].join(" ")}
                          >
                            {doc.title} ↗
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Projects */}
            {hasProjects && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {effectiveProjects.small.length > 0 && (
                  <div>
                    <h3 className="font-mono text-[10px] tracking-widest uppercase text-[var(--ink-muted)] mb-2">
                      Starter Projects
                    </h3>
                    <ul className="space-y-1.5 list-none">
                      {effectiveProjects.small.map((p, i) => (
                        <li key={i} className="flex gap-2 items-start">
                          <span className="font-mono text-[var(--ink-muted)] text-xs mt-0.5 flex-none">
                            ◦
                          </span>
                          <span className="font-sans text-xs text-[var(--ink-dim)] leading-snug">
                            {p}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {effectiveProjects.big.length > 0 && (
                  <div>
                    <h3 className="font-mono text-[10px] tracking-widest uppercase text-[var(--ink-muted)] mb-2">
                      Capstone Projects
                    </h3>
                    <ul className="space-y-1.5 list-none">
                      {effectiveProjects.big.map((p, i) => (
                        <li key={i} className="flex gap-2 items-start">
                          <span
                            className={[
                              "font-mono text-xs mt-0.5 flex-none",
                              isToolKind
                                ? "text-[var(--amber-dim)]"
                                : "text-[var(--sage-dim)]",
                            ].join(" ")}
                          >
                            ◆
                          </span>
                          <span className="font-sans text-xs text-[var(--ink-dim)] leading-snug">
                            {p}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
