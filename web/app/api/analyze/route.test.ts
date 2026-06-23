import { describe, it, expect } from "vitest";
import { runGoalAnalysis } from "./_helpers";
import type { ExtractedRepo } from "@/lib/engine/types";
import type { AnalysisResult } from "@/lib/result-types";
import type { SynthesisInput } from "@/lib/engine/synthesis";

function erepo(owner: string, name: string, tools: string[], description = ""): ExtractedRepo {
  return {
    fullName: `${owner}/${name}`,
    owner,
    pushedAt: new Date("2026-06-01T00:00:00Z"),
    tools: new Set(tools),
    description,
    topics: [],
  };
}

const cannedResult: AnalysisResult = {
  goal: "founding-engineer",
  generatedAt: "2026-06-13T00:00:00Z",
  targetsAnalyzed: 1,
  summary: "You are strong on ML but read as a researcher, not a builder.",
  concepts: [
    {
      id: "agent-orchestration",
      name: "Agent orchestration",
      stage: "current-frontier",
      youHave: "missing",
      importanceForGoal: 5,
      evidence: [],
      relationships: [],
    },
  ],
  learningPath: [
    {
      conceptId: "agent-orchestration",
      rank: 1,
      whyNow: "frontier",
      whatToLearn: "build a multi-agent loop",
      resources: [],
      project: "build an orchestrator",
    },
  ],
  projectGaps: [{ theme: "agent eval harness", seenIn: ["alice/agent"], suggestion: "build one" }],
  positioning: {
    currentSignal: "researcher-leaning",
    evidence: ["papers"],
    targetSignal: "builder/shipper",
    gap: "research overshadows shipping",
    moves: ["foreground 0→1 work"],
  },
  baseline: { tools: ["fastapi", "pytorch"] },
  comparisons: [{ handle: "alice", theirSignal: "builder", theyHaveYouDont: ["orchestration"], youHaveTheyDont: ["research"], shared: ["python"], notableProjects: ["agent-x"], takeaway: "Alice is ahead on orchestration." }],
};

describe("runGoalAnalysis", () => {
  it("merges own-repo tools with resumeSkills into the synthesis baseline", async () => {
    let capturedInput: SynthesisInput | undefined;

    const deps = {
      harvest: async (u: string) =>
        u === "me"
          ? [erepo("me", "my-api", ["fastapi", "docker"], "my api project")]
          : [erepo("alice", "agent", ["langchain", "openai"], "an agent")],
      synthesize: async (input: SynthesisInput): Promise<AnalysisResult> => {
        capturedInput = input;
        return { ...cannedResult };
      },
    };

    const result = await runGoalAnalysis(deps, {
      resumeSkills: ["pytorch", "numpy"],
      githubUsername: "me",
      goal: "founding-engineer",
      handles: ["alice"],
    });

    // Assert own-repo tools + resumeSkills all merged into baseline
    expect(capturedInput).toBeDefined();
    const baselineTools = capturedInput!.baselineTools;
    expect(baselineTools).toContain("pytorch");   // from resumeSkills
    expect(baselineTools).toContain("numpy");      // from resumeSkills
    expect(baselineTools).toContain("fastapi");    // from own repo
    expect(baselineTools).toContain("docker");     // from own repo

    // Assert result has concepts + positioning
    expect(result.concepts.length).toBeGreaterThan(0);
    expect(result.concepts[0].id).toBe("agent-orchestration");
    expect(result.positioning).toBeDefined();
    expect(result.positioning.currentSignal).toBe("researcher-leaning");

    // Assert targetsAnalyzed matches the number of handles
    expect(result.targetsAnalyzed).toBe(1);
  });

  it("respects BOUNDS.MAX_PEOPLE and caps handles", async () => {
    const harvested: string[] = [];

    const deps = {
      harvest: async (u: string) => {
        harvested.push(u);
        return [erepo(u, "repo", ["go"])];
      },
      synthesize: async (_input: SynthesisInput): Promise<AnalysisResult> => ({
        ...cannedResult,
      }),
    };

    // Pass more handles than MAX_PEOPLE (5)
    const manyHandles = ["a", "b", "c", "d", "e", "f", "g"];
    await runGoalAnalysis(deps, {
      resumeSkills: [],
      githubUsername: "me",
      goal: "founding-engineer",
      handles: manyHandles,
    });

    // "me" is harvested first (own repos), then at most MAX_PEOPLE targets
    const targetHarvests = harvested.filter((u) => u !== "me");
    expect(targetHarvests.length).toBeLessThanOrEqual(5);
  });

  it("includes own projects in yourProjects from own repos", async () => {
    let capturedInput: SynthesisInput | undefined;

    const deps = {
      harvest: async (u: string) =>
        u === "me"
          ? [erepo("me", "cool-project", ["rust"], "a cool rust project")]
          : [],
      synthesize: async (input: SynthesisInput): Promise<AnalysisResult> => {
        capturedInput = input;
        return { ...cannedResult };
      },
    };

    await runGoalAnalysis(deps, {
      resumeSkills: [],
      githubUsername: "me",
      goal: "founding-engineer",
      handles: [],
    });

    expect(capturedInput!.yourProjects).toContainEqual({
      name: "cool-project",
      description: "a cool rust project",
    });
  });
});
