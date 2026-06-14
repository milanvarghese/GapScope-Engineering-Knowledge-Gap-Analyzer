"use client";

import { useState, useMemo } from "react";
import type { Report } from "@/lib/types";
import { uploadResume, analyze } from "@/lib/client";
import ResumeUpload from "@/components/ResumeUpload";
import SkillChips from "@/components/SkillChips";
import TargetPicker from "@/components/TargetPicker";
import Dashboard from "@/components/Dashboard";

type Phase = "setup" | "running" | "results";

export default function AnalyzerApp() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [skills, setSkills] = useState<string[]>([]);
  const [role, setRole] = useState("ai-engineer");
  const [handles, setHandles] = useState<string[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const canAnalyze = skills.length > 0 && handles.length > 0;

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const { tools } = await uploadResume(file);
      setSkills(tools);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to read résumé");
    } finally {
      setUploading(false);
    }
  }

  async function handleAnalyze() {
    if (!canAnalyze) return;
    setPhase("running");
    setError(null);
    try {
      const report = await analyze({ baseline: { tools: skills }, handles, role });
      setReport(report);
      setPhase("results");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Analysis failed");
      setPhase("setup");
    }
  }

  function handleReset() {
    setPhase("setup");
    setReport(null);
    setError(null);
  }

  // ── results ──────────────────────────────────────────────────────────────
  if (phase === "results" && report) {
    return (
      <div>
        {/* Back button strip */}
        <div className="border-b border-[var(--rule)] bg-[var(--canvas-2)] px-5 py-2 flex items-center gap-4">
          <button
            onClick={handleReset}
            className="font-mono text-xs text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors duration-150 flex items-center gap-1.5"
          >
            ← New analysis
          </button>
        </div>
        <Dashboard report={report} />
      </div>
    );
  }

  // ── running ───────────────────────────────────────────────────────────────
  if (phase === "running") {
    return (
      <div className="min-h-screen bg-[var(--canvas)] flex flex-col">
        <AppHeader />
        <main className="max-w-2xl mx-auto w-full px-5 py-12">
          <div className="border border-[var(--rule-bright)] bg-[var(--canvas-2)] px-5 py-6 flex items-center gap-3">
            <span className="relative flex h-2 w-2 flex-none">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--amber)] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--amber-dim)]" />
            </span>
            <span className="font-mono text-xs text-[var(--ink-dim)]">
              Analyzing {handles.length} engineer{handles.length !== 1 ? "s" : ""} — this can take up to a minute…
            </span>
          </div>
        </main>
      </div>
    );
  }

  // ── setup ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--canvas)] flex flex-col">
      <AppHeader />
      <main className="max-w-2xl mx-auto w-full px-5 py-10 space-y-10">
        {/* Error banner */}
        {error && (
          <div className="border border-[var(--rule-bright)] px-5 py-3 bg-[var(--canvas-2)]">
            <span className="font-mono text-xs text-[var(--ink-muted)] tracking-widest uppercase mr-3">
              Error
            </span>
            <span className="font-mono text-xs text-[var(--ink)]">{error}</span>
          </div>
        )}

        {/* Step 1: résumé */}
        <section>
          <SectionLabel index="01" title="Upload résumé" />
          <ResumeUpload onUpload={handleUpload} loading={uploading} />
        </section>

        {/* Step 2: skills */}
        <section>
          <SectionLabel index="02" title="Confirm extracted skills" />
          <SkillChips skills={skills} onChange={setSkills} />
        </section>

        {/* Step 3: targets */}
        <section>
          <SectionLabel index="03" title="Set analysis targets" />
          <TargetPicker
            role={role}
            onRole={setRole}
            handles={handles}
            onHandles={setHandles}
          />
        </section>

        {/* Analyze button */}
        <div className="pt-2">
          <button
            onClick={handleAnalyze}
            disabled={!canAnalyze}
            className={[
              "w-full font-mono text-sm tracking-widest uppercase py-3.5 border transition-colors duration-150",
              canAnalyze
                ? "border-[var(--amber)] text-[var(--amber)] hover:bg-[var(--amber-dim)]/15 cursor-pointer"
                : "border-[var(--rule-bright)] text-[var(--ink-muted)] cursor-not-allowed",
            ].join(" ")}
          >
            {canAnalyze ? "Analyze →" : "Add skills and at least one handle"}
          </button>
        </div>
      </main>
    </div>
  );
}

function AppHeader() {
  return (
    <header className="border-b border-[var(--rule-bright)] bg-[var(--canvas-2)] sticky top-0 z-10">
      <div className="h-px bg-gradient-to-r from-[var(--amber)] via-[var(--amber-dim)] to-transparent" />
      <div className="max-w-2xl mx-auto px-5 py-4 flex items-baseline gap-3">
        <span className="font-mono text-2xl font-medium tracking-tighter text-[var(--ink)]">
          Gap<span className="text-[var(--amber)]">Scope</span>
        </span>
        <span className="font-mono text-[10px] tracking-widest uppercase text-[var(--ink-muted)] pb-0.5">
          Knowledge Gap Analyzer
        </span>
      </div>
    </header>
  );
}

function SectionLabel({ index, title }: { index: string; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="font-mono text-[10px] tracking-widest text-[var(--ink-muted)]">
        {index}
      </span>
      <span className="flex-1 h-px bg-[var(--rule)]" />
      <span className="font-mono text-[10px] tracking-widest uppercase text-[var(--ink-dim)]">
        {title}
      </span>
    </div>
  );
}
