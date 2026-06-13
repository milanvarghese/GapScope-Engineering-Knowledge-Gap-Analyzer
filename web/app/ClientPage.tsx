"use client";

import { useEffect, useState } from "react";
import type { Report } from "@/lib/types";
import Dashboard from "@/components/Dashboard";

export default function ClientPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<Report>;
      })
      .then(setReport)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Failed to load report");
      });
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--canvas)] flex items-center justify-center">
        <div className="border border-[var(--rule-bright)] px-8 py-6 max-w-md">
          <p className="font-mono text-xs text-[var(--ink-muted)] tracking-widest uppercase mb-2">
            Error
          </p>
          <p className="font-mono text-sm text-[var(--ink)]">{error}</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-[var(--canvas)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="font-mono text-xl font-medium tracking-tighter text-[var(--ink)]">
            Gap<span className="text-[var(--amber)]">Scope</span>
          </span>
          <span className="font-mono text-[10px] tracking-widest uppercase text-[var(--ink-muted)] animate-pulse">
            Loading report...
          </span>
        </div>
      </div>
    );
  }

  return <Dashboard report={report} />;
}
