import type { ExtractedRepo } from "@/lib/engine/types";
import type { SynthesisInput } from "@/lib/engine/synthesis";
import type { AnalysisResult } from "@/lib/result-types";
import { presetById } from "@/lib/engine/goals";
import { BOUNDS } from "@/lib/engine/config";
import { mapPool } from "@/lib/engine/concurrency";

export type GoalAnalysisDeps = {
  harvest(user: string): Promise<ExtractedRepo[]>;
  inferReadme(text: string): Promise<string[]>;
  synthesize(input: SynthesisInput): Promise<AnalysisResult>;
};

export type GoalAnalysisBody = {
  resumeSkills: string[];
  githubUsername: string;
  goal: string;
  handles: string[];
};

export async function runGoalAnalysis(
  deps: GoalAnalysisDeps,
  body: GoalAnalysisBody,
): Promise<AnalysisResult> {
  // 1. Harvest own repos → baseline tools + own projects
  const ownRepos = await deps.harvest(body.githubUsername);
  const ownTools = new Set<string>(body.resumeSkills.map((s) => s.toLowerCase().trim()).filter(Boolean));
  for (const repo of ownRepos) {
    for (const t of repo.tools) ownTools.add(t);
  }
  const baselineTools = Array.from(ownTools);
  const yourProjects = ownRepos.map((r) => ({
    name: r.fullName.split("/").pop()!,
    description: r.description,
  }));

  // 2. Harvest each target handle (bounded to MAX_PEOPLE), concurrently
  const handles = body.handles.slice(0, BOUNDS.MAX_PEOPLE);

  const targetResults = await mapPool(
    handles,
    BOUNDS.CONCURRENCY,
    async (handle) => {
      let repos: ExtractedRepo[] = [];
      try {
        repos = await deps.harvest(handle);
      } catch {
        repos = [];
      }
      // Derive methodology tags from repo names+descriptions (no extra GitHub calls)
      const summaryText = repos
        .map((r) => `${r.fullName.split("/").pop()} ${r.description}`)
        .join(". ");
      let methodologies: string[] = [];
      if (summaryText.trim()) {
        try {
          methodologies = await deps.inferReadme(summaryText);
        } catch {
          methodologies = [];
        }
      }
      const tools = Array.from(
        new Set(repos.flatMap((r) => Array.from(r.tools))),
      );
      const projects = repos.map((r) => ({
        name: r.fullName.split("/").pop()!,
        description: r.description,
      }));
      return { handle, tools, methodologies, projects };
    },
  );

  // 3. Build SynthesisInput
  const preset = presetById(body.goal);
  const expectedSignal =
    preset?.expectedSignal ?? "strong engineer who ships and owns systems";

  const input: SynthesisInput = {
    goal: body.goal,
    expectedSignal,
    baselineTools,
    yourProjects,
    targets: targetResults,
  };

  // 4. Synthesize
  const result = await deps.synthesize(input);

  // Ensure targetsAnalyzed is set
  result.targetsAnalyzed = targetResults.length;

  return result;
}
