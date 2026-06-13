"use client";

import type { Gap } from "@/lib/types";
import GapRow from "./GapRow";

interface GapListProps {
  gaps: Gap[];
}

export default function GapList({ gaps }: GapListProps) {
  if (gaps.length === 0) {
    return (
      <div className="border border-[var(--rule)] px-6 py-12 text-center">
        <span className="font-mono text-xs text-[var(--ink-muted)] tracking-widest uppercase">
          No gaps match the current filter
        </span>
      </div>
    );
  }

  return (
    <div className="border border-[var(--rule)] overflow-hidden">
      {/* Table header */}
      <div className="flex items-stretch bg-[var(--canvas-2)] border-b border-[var(--rule-bright)]">
        <span className="w-10 flex-none flex items-center justify-center font-mono text-[10px] text-[var(--ink-muted)] tracking-widest uppercase border-r border-[var(--rule)] py-2.5">
          #
        </span>
        <span className="w-1 flex-none" />
        <span className="flex-1 font-mono text-[10px] text-[var(--ink-muted)] tracking-widest uppercase px-4 py-2.5">
          Gap
        </span>
        <span className="hidden sm:flex w-20 flex-none font-mono text-[10px] text-[var(--ink-muted)] tracking-widest uppercase px-4 py-2.5 border-l border-[var(--rule)]">
          Freq
        </span>
        <span className="hidden sm:flex w-36 flex-none font-mono text-[10px] text-[var(--ink-muted)] tracking-widest uppercase px-4 py-2.5 border-l border-[var(--rule)]">
          Rank Score
        </span>
        <span className="w-10 flex-none border-l border-[var(--rule)]" />
      </div>

      {/* Rows */}
      {gaps.map((gap, index) => (
        <GapRow
          key={gap.id}
          gap={gap}
          rank={index + 1}
          animationDelay={index * 50}
        />
      ))}
    </div>
  );
}
