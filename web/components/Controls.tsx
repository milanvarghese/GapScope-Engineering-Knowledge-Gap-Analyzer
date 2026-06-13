"use client";

type FilterKind = "all" | "tool" | "methodology";

interface ControlsProps {
  filter: FilterKind;
  onFilterChange: (f: FilterKind) => void;
  search: string;
  onSearchChange: (s: string) => void;
  totalCount: number;
  visibleCount: number;
}

const FILTERS: { label: string; value: FilterKind }[] = [
  { label: "All", value: "all" },
  { label: "Tools", value: "tool" },
  { label: "Methods", value: "methodology" },
];

export default function Controls({
  filter,
  onFilterChange,
  search,
  onSearchChange,
  totalCount,
  visibleCount,
}: ControlsProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
      {/* Segmented filter */}
      <div
        className="flex border border-[var(--rule-bright)] overflow-hidden"
        role="group"
        aria-label="Filter gaps by kind"
      >
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => onFilterChange(f.value)}
            aria-pressed={filter === f.value}
            className={[
              "px-4 py-1.5 font-mono text-xs tracking-widest uppercase transition-colors duration-150 border-r border-[var(--rule-bright)] last:border-r-0",
              filter === f.value
                ? "bg-[var(--ink-faint)] text-[var(--ink)] font-medium"
                : "text-[var(--ink-muted)] hover:text-[var(--ink-dim)] hover:bg-[var(--canvas-3)]",
            ].join(" ")}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative flex-1 max-w-xs">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[var(--ink-muted)] text-xs select-none">
          /
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="filter by name..."
          aria-label="Filter gaps by name"
          className="w-full bg-[var(--canvas-3)] border border-[var(--rule-bright)] text-[var(--ink)] font-mono text-xs pl-7 pr-3 py-1.5 placeholder-[var(--ink-muted)] focus:outline-none focus:border-[var(--amber-dim)] transition-colors duration-150"
        />
      </div>

      {/* Count */}
      <span className="font-mono text-xs text-[var(--ink-muted)] ml-auto whitespace-nowrap">
        {visibleCount} / {totalCount} gaps
      </span>
    </div>
  );
}
