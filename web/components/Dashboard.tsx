"use client";

import { useState, useMemo } from "react";
import type { Report } from "@/lib/types";
import Controls from "./Controls";
import GapList from "./GapList";
import BaselinePanel from "./BaselinePanel";

type FilterKind = "all" | "tool" | "methodology";

interface DashboardProps {
  report: Report;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function Dashboard({ report }: DashboardProps) {
  const [filter, setFilter] = useState<FilterKind>("all");
  const [search, setSearch] = useState("");

  const sortedGaps = useMemo(
    () => [...report.gaps].sort((a, b) => b.rankScore - a.rankScore),
    [report.gaps]
  );

  const visibleGaps = useMemo(() => {
    return sortedGaps.filter((g) => {
      const matchesKind = filter === "all" || g.kind === filter;
      const matchesSearch =
        search.trim() === "" ||
        g.name.toLowerCase().includes(search.toLowerCase());
      return matchesKind && matchesSearch;
    });
  }, [sortedGaps, filter, search]);

  const toolCount = sortedGaps.filter((g) => g.kind === "tool").length;
  const methodCount = sortedGaps.filter((g) => g.kind === "methodology").length;

  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      {/* Header */}
      <header className="border-b border-[var(--rule-bright)] bg-[var(--canvas-2)] sticky top-0 z-10">
        {/* Top rule */}
        <div className="h-px bg-gradient-to-r from-[var(--amber)] via-[var(--amber-dim)] to-transparent" />
        <div className="max-w-5xl mx-auto px-5 py-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-8">
            {/* Wordmark */}
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-2xl font-medium tracking-tighter text-[var(--ink)]">
                Gap<span className="text-[var(--amber)]">Scope</span>
              </span>
              <span className="font-mono text-[10px] tracking-widest uppercase text-[var(--ink-muted)] pb-0.5">
                Knowledge Gap Analyzer
              </span>
            </div>

            {/* Meta stats */}
            <div className="flex items-center gap-5 ml-auto">
              <div className="flex flex-col items-end">
                <span className="font-mono text-[10px] tracking-widest uppercase text-[var(--ink-muted)]">
                  Role
                </span>
                <span className="font-mono text-sm text-[var(--ink)]">
                  {report.meta.role}
                </span>
              </div>
              <div className="w-px h-8 bg-[var(--rule-bright)]" />
              <div className="flex flex-col items-end">
                <span className="font-mono text-[10px] tracking-widest uppercase text-[var(--ink-muted)]">
                  Targets
                </span>
                <span className="font-mono text-sm text-[var(--ink)]">
                  {report.meta.targetsAnalyzed}
                </span>
              </div>
              <div className="w-px h-8 bg-[var(--rule-bright)]" />
              <div className="flex flex-col items-end">
                <span className="font-mono text-[10px] tracking-widest uppercase text-[var(--ink-muted)]">
                  Generated
                </span>
                <span className="font-mono text-sm text-[var(--ink)]">
                  {formatDate(report.meta.generatedAt)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-5 py-8">
        {/* Gap summary badges */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex items-center gap-2 px-3 py-1.5 border border-[var(--amber-dim)] bg-[var(--amber-dim)]/5">
            <span className="w-1.5 h-1.5 bg-[var(--amber)]" />
            <span className="font-mono text-xs text-[var(--amber)]">
              {toolCount} tool gap{toolCount !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 border border-[var(--sage-dim)] bg-[var(--sage-dim)]/5">
            <span className="w-1.5 h-1.5 bg-[var(--sage)]" />
            <span className="font-mono text-xs text-[var(--sage-glow)]">
              {methodCount} methodology gap{methodCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Baseline */}
        <BaselinePanel tools={report.baseline.tools} />

        {/* Controls */}
        <Controls
          filter={filter}
          onFilterChange={setFilter}
          search={search}
          onSearchChange={setSearch}
          totalCount={sortedGaps.length}
          visibleCount={visibleGaps.length}
        />

        {/* Gap list */}
        <GapList gaps={visibleGaps} />

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-[var(--rule)] flex items-center justify-between">
          <span className="font-mono text-[10px] text-[var(--ink-muted)] tracking-widest uppercase">
            GapScope
          </span>
          <span className="font-mono text-[10px] text-[var(--ink-muted)]">
            {report.gaps.length} gaps · {report.baseline.tools.length} baseline tools
          </span>
        </footer>
      </main>
    </div>
  );
}
