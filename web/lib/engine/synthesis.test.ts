import { describe, it, expect } from "vitest";
import { synthesize, orderLearningPath } from "./synthesis";

const raw = {
  goal: "founding-engineer", generatedAt: "2026-06-13T00:00:00Z", targetsAnalyzed: 1,
  summary: "s",
  concepts: [
    { id: "evals", name: "Evals", stage: "emerging", youHave: "missing", importanceForGoal: 5, evidence: [], relationships: [] },
    { id: "orch", name: "Orchestration", stage: "current-frontier", youHave: "missing", importanceForGoal: 5, evidence: [], relationships: [{ type: "prerequisite-of", target: "evals" }] },
  ],
  learningPath: [
    { conceptId: "evals", rank: 1, whyNow: "w", whatToLearn: "l", resources: [{ title: "a", url: "https://dead", verified: false }, { title: "b", url: "https://live", verified: false }], project: "p" },
    { conceptId: "orch", rank: 2, whyNow: "w", whatToLearn: "l", resources: [], project: "p" },
  ],
  projectGaps: [], positioning: { currentSignal: "x", evidence: [], targetSignal: "y", gap: "g", moves: [] },
  baseline: { tools: [] },
};

describe("synthesis", () => {
  it("orders prerequisite before dependent and by stage*importance", () => {
    const ordered = orderLearningPath(raw.concepts as any, raw.learningPath as any);
    expect(ordered.map((s) => s.conceptId)).toEqual(["orch", "evals"]); // orch is prerequisite-of evals
    expect(ordered[0].rank).toBe(1);
    expect(ordered[1].rank).toBe(2);
  });
  it("drops unverified links and keeps verified", async () => {
    const deps = { generate: async () => raw, verify: async (u: string) => u === "https://live" };
    const result = await synthesize(deps, { goal: "founding-engineer", expectedSignal: "builder", baselineTools: [], yourProjects: [], targets: [] });
    const evals = result.learningPath.find((s) => s.conceptId === "evals")!;
    expect(evals.resources.map((r) => r.url)).toEqual(["https://live"]);
    expect(evals.resources[0].verified).toBe(true);
  });
});
