"use client";

import type { Concept, Stage, Have } from "@/lib/result-types";

const STAGE_ORDER: Stage[] = ["fading", "table-stakes", "current-frontier", "emerging"];

const STAGE_LABEL: Record<Stage, string> = {
  "fading": "Fading",
  "table-stakes": "Table Stakes",
  "current-frontier": "Frontier",
  "emerging": "Emerging",
};

const STAGE_COLOR: Record<Stage, { header: string; border: string; dot: string }> = {
  "fading": {
    header: "text-[var(--ink-muted)]",
    border: "border-[var(--rule-bright)]",
    dot: "bg-[var(--ink-faint)]",
  },
  "table-stakes": {
    header: "text-[var(--ink-dim)]",
    border: "border-[var(--rule-bright)]",
    dot: "bg-[var(--ink-muted)]",
  },
  "current-frontier": {
    header: "text-[var(--amber)]",
    border: "border-[var(--amber-dim)]",
    dot: "bg-[var(--amber)]",
  },
  "emerging": {
    header: "text-[var(--sage-glow)]",
    border: "border-[var(--sage-dim)]",
    dot: "bg-[var(--sage)]",
  },
};

const HAVE_STYLE: Record<Have, { chip: string; marker: string; label: string }> = {
  solid: {
    chip: "bg-[var(--canvas-3)] border-[var(--sage-dim)] text-[var(--sage-glow)]",
    marker: "◆",
    label: "solid",
  },
  partial: {
    chip: "bg-[var(--canvas-3)] border-[var(--amber-dim)] text-[var(--amber)]",
    marker: "◈",
    label: "partial",
  },
  missing: {
    chip: "bg-[var(--canvas-3)] border-[var(--rule-bright)] text-[var(--ink-muted)]",
    marker: "◇",
    label: "missing",
  },
};

interface Props {
  concepts: Concept[];
}

export default function DomainMap({ concepts }: Props) {
  const byStage = STAGE_ORDER.reduce<Record<Stage, Concept[]>>((acc, stage) => {
    acc[stage] = concepts.filter((c) => c.stage === stage);
    return acc;
  }, { fading: [], "table-stakes": [], "current-frontier": [], emerging: [] });

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="font-mono text-[10px] tracking-widest uppercase text-[var(--ink-muted)]">
          Domain map
        </span>
        <span className="flex-1 h-px bg-[var(--rule)]" />
        {/* Legend */}
        <div className="flex items-center gap-3">
          {(["solid", "partial", "missing"] as Have[]).map((h) => (
            <span key={h} className="flex items-center gap-1">
              <span className={`font-mono text-[9px] ${HAVE_STYLE[h].chip.split(" ").find(c => c.startsWith("text-")) ?? ""}`}>
                {HAVE_STYLE[h].marker}
              </span>
              <span className="font-mono text-[9px] text-[var(--ink-muted)] tracking-widest uppercase">
                {h}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Trajectory indicator */}
      <div className="flex items-center gap-0 mb-4 overflow-hidden border border-[var(--rule)]">
        {STAGE_ORDER.map((stage, i) => {
          const colors = STAGE_COLOR[stage];
          const count = byStage[stage].length;
          return (
            <div
              key={stage}
              className={[
                "flex-1 flex flex-col items-center py-2 gap-0.5",
                i < STAGE_ORDER.length - 1 ? "border-r border-[var(--rule)]" : "",
              ].join(" ")}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${colors.dot} mb-0.5`} />
              <span className={`font-mono text-[9px] tracking-widest uppercase ${colors.header}`}>
                {STAGE_LABEL[stage]}
              </span>
              <span className="font-mono text-[9px] text-[var(--ink-muted)]">
                {count} concept{count !== 1 ? "s" : ""}
              </span>
            </div>
          );
        })}
        {/* Arrow overlay */}
        <div className="absolute pointer-events-none" aria-hidden />
      </div>

      {/* Four column grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STAGE_ORDER.map((stage) => {
          const cols = byStage[stage];
          const colors = STAGE_COLOR[stage];
          return (
            <div key={stage} className={`border ${colors.border} flex flex-col`}>
              <div className={`border-b ${colors.border} px-3 py-2`}>
                <span className={`font-mono text-[10px] tracking-widest uppercase ${colors.header}`}>
                  {STAGE_LABEL[stage]}
                </span>
              </div>
              <div className="px-3 py-2.5 flex flex-col gap-2 flex-1">
                {cols.length === 0 ? (
                  <span className="font-mono text-[10px] text-[var(--ink-faint)]">—</span>
                ) : (
                  cols.map((c) => {
                    const haveStyle = HAVE_STYLE[c.youHave];
                    return (
                      <div
                        key={c.id}
                        className={`border ${haveStyle.chip} px-2 py-1.5 flex items-start gap-1.5`}
                        title={`${c.youHave} · importance ${c.importanceForGoal}/5`}
                      >
                        <span className="font-mono text-[10px] flex-none mt-0.5 leading-none">
                          {haveStyle.marker}
                        </span>
                        <span className="font-sans text-[11px] leading-tight break-words min-w-0">
                          {c.name}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
