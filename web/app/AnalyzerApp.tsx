"use client";

import { useState } from "react";
import type { AnalysisResult } from "@/lib/result-types";
import { GOAL_PRESETS } from "@/lib/engine/goals";
import { uploadResume, analyze } from "@/lib/client";
import { normalizeHandle } from "@/lib/engine/handle";
import ResumeUpload from "@/components/ResumeUpload";
import SkillChips from "@/components/SkillChips";
import TargetPicker from "@/components/TargetPicker";
import PositioningPanel from "@/components/PositioningPanel";
import DomainMap from "@/components/DomainMap";
import LearningPath from "@/components/LearningPath";
import ProjectGaps from "@/components/ProjectGaps";
import { presetById } from "@/lib/engine/goals";

type Phase = "setup" | "running" | "results";

export default function AnalyzerApp() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [skills, setSkills] = useState<string[]>([]);
  const [githubUsername, setGithubUsername] = useState("");
  const [goal, setGoal] = useState(GOAL_PRESETS[0].id);
  const [handles, setHandles] = useState<string[]>(GOAL_PRESETS[0].defaultHandles);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const canAnalyze = skills.length > 0 && githubUsername.trim().length > 0 && handles.length > 0;

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

  function handleGoalChange(newGoal: string) {
    setGoal(newGoal);
    const preset = GOAL_PRESETS.find((g) => g.id === newGoal);
    if (preset) setHandles(preset.defaultHandles);
  }

  async function handleAnalyze() {
    if (!canAnalyze) return;
    setPhase("running");
    setError(null);
    try {
      const r = await analyze({ resumeSkills: skills, githubUsername: normalizeHandle(githubUsername), goal, handles: handles.map(normalizeHandle) });
      setResult(r);
      setPhase("results");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Analysis failed");
      setPhase("setup");
    }
  }

  function handleReset() {
    setPhase("setup");
    setResult(null);
    setError(null);
  }

  // ── results ──────────────────────────────────────────────────────────────
  if (phase === "results" && result) {
    const goalLabel = presetById(result.goal)?.label ?? result.goal;
    const dateFormatted = new Date(result.generatedAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    return (
      <div className="min-h-screen bg-[var(--canvas)]">
        {/* Nav strip */}
        <div className="border-b border-[var(--rule)] bg-[var(--canvas-2)] px-5 py-2 flex items-center gap-4 sticky top-0 z-10">
          <button
            onClick={handleReset}
            className="font-mono text-sm text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors duration-150 flex items-center gap-1.5"
          >
            ← New analysis
          </button>
        </div>

        <div className="max-w-4xl mx-auto px-5 py-8 space-y-10">

          {/* Goal banner */}
          <div className="border border-[var(--rule-bright)] bg-[var(--canvas-2)]">
            <div className="h-px bg-gradient-to-r from-[var(--amber)] via-[var(--amber-dim)] to-transparent" />
            <div className="px-5 py-5">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-4">
                <h1 className="font-mono text-xl font-medium tracking-tight text-[var(--ink)]">
                  Path to:{" "}
                  <span className="text-[var(--amber)]">{goalLabel}</span>
                </h1>
                <div className="flex items-center gap-4 ml-auto">
                  <span className="font-mono text-[11px] tracking-widest uppercase text-[var(--ink-muted)]">
                    {result.targetsAnalyzed} engineer{result.targetsAnalyzed !== 1 ? "s" : ""} analyzed
                  </span>
                  <span className="font-mono text-[11px] text-[var(--ink-muted)]">{dateFormatted}</span>
                </div>
              </div>
              <p className="font-serif text-sm text-[var(--ink-dim)] leading-relaxed italic max-w-2xl">
                {result.summary}
              </p>
            </div>
          </div>

          {/* Positioning — prominent, near top */}
          <PositioningPanel positioning={result.positioning} />

          {/* Domain map */}
          <DomainMap concepts={result.concepts} />

          {/* Learning path */}
          <LearningPath learningPath={result.learningPath} concepts={result.concepts} />

          {/* Project gaps */}
          <ProjectGaps gaps={result.projectGaps} />

          {/* Caveat footer */}
          <div className="border-t border-[var(--rule)] pt-6 pb-10">
            <p className="font-mono text-[11px] text-[var(--ink-muted)] leading-relaxed max-w-2xl">
              This measures the skills + signal dimension of eligibility from public evidence.
              Interview, system-design, and behavioral readiness are a separate axis.
            </p>
          </div>

        </div>
      </div>
    );
  }

  // ── running ───────────────────────────────────────────────────────────────
  if (phase === "running") {
    return (
      <div className="min-h-screen bg-[var(--canvas)] flex flex-col">
        <AppHeader />
        <main className="max-w-3xl mx-auto w-full px-5 py-12">
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
      <main className="max-w-3xl mx-auto w-full px-5 py-10 space-y-10">
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

        {/* Step 3: GitHub username */}
        <section>
          <SectionLabel index="03" title="Your GitHub username" />
          <input
            type="text"
            value={githubUsername}
            onChange={(e) => setGithubUsername(e.target.value)}
            placeholder="username or github.com/username"
            aria-label="Your GitHub username"
            className="w-full bg-[var(--canvas-3)] border border-[var(--rule-bright)] text-[var(--ink)] font-mono text-xs px-3 py-1.5 placeholder-[var(--ink-muted)] focus:outline-none focus:border-[var(--amber-dim)] transition-colors duration-150"
          />
        </section>

        {/* Step 4: Goal */}
        <section>
          <SectionLabel index="04" title="Goal" />
          <div className="space-y-3">
            <select
              value={goal}
              onChange={(e) => handleGoalChange(e.target.value)}
              aria-label="Select goal"
              className="w-full bg-[var(--canvas-3)] border border-[var(--rule-bright)] text-[var(--ink)] font-mono text-xs px-3 py-1.5 focus:outline-none focus:border-[var(--amber-dim)] transition-colors duration-150 appearance-none"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%235c5a55'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", paddingRight: "2rem" }}
            >
              {GOAL_PRESETS.map((g) => (
                <option key={g.id} value={g.id}>{g.label}</option>
              ))}
              <option value="__custom__">Other (free text)</option>
            </select>
            {goal === "__custom__" && (
              <input
                type="text"
                placeholder="Describe your goal…"
                aria-label="Custom goal"
                onChange={(e) => setGoal(e.target.value)}
                className="w-full bg-[var(--canvas-3)] border border-[var(--rule-bright)] text-[var(--ink)] font-mono text-xs px-3 py-1.5 placeholder-[var(--ink-muted)] focus:outline-none focus:border-[var(--amber-dim)] transition-colors duration-150"
              />
            )}
          </div>
        </section>

        {/* Step 5: target handles */}
        <section>
          <SectionLabel index="05" title="Exemplar handles" />
          <TargetPicker handles={handles} onHandles={setHandles} />
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
            {canAnalyze ? "Analyze →" : "Add skills, your GitHub username, and at least one handle"}
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
      <div className="max-w-3xl mx-auto px-5 py-4 flex items-baseline gap-3">
        <span className="font-mono text-2xl font-medium tracking-tighter text-[var(--ink)]">
          Gap<span className="text-[var(--amber)]">Scope</span>
        </span>
        <span className="font-mono text-[11px] tracking-widest uppercase text-[var(--ink-muted)] pb-0.5">
          Knowledge Gap Analyzer
        </span>
      </div>
    </header>
  );
}

function SectionLabel({ index, title }: { index: string; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="font-mono text-[11px] tracking-widest text-[var(--ink-muted)]">
        {index}
      </span>
      <span className="flex-1 h-px bg-[var(--rule)]" />
      <span className="font-mono text-[11px] tracking-widest uppercase text-[var(--ink-dim)]">
        {title}
      </span>
    </div>
  );
}
