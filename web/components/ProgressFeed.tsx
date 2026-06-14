"use client";

interface ProgressFeedProps {
  lines: string[];
}

export default function ProgressFeed({ lines }: ProgressFeedProps) {
  return (
    <div className="border border-[var(--rule-bright)] bg-[var(--canvas-2)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--rule)]">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--amber)] opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--amber-dim)]" />
        </span>
        <span className="font-mono text-[10px] tracking-widest uppercase text-[var(--amber)]">
          analyzing…
        </span>
      </div>

      {/* Log lines */}
      <div className="px-5 py-4 space-y-1.5 min-h-[120px]">
        {lines.length === 0 && (
          <span className="font-mono text-xs text-[var(--ink-muted)] animate-pulse">
            starting…
          </span>
        )}
        {lines.map((line, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="font-mono text-[10px] text-[var(--ink-faint)] mt-0.5 select-none flex-none">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="font-mono text-xs text-[var(--ink-dim)] leading-snug">
              {line}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
