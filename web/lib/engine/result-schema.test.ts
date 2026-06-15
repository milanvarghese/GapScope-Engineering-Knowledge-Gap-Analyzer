import { describe, it, expect } from "vitest";
import { AnalysisResultSchema } from "./result-schema";

const sample = {
  goal: "founding-engineer", generatedAt: "2026-06-13T00:00:00Z", targetsAnalyzed: 3,
  summary: "You're strong on ML research but read as a researcher, not a builder.",
  concepts: [{ id: "agent-orchestration", name: "Agent orchestration", stage: "current-frontier",
    youHave: "missing", importanceForGoal: 5, evidence: ["alice/agent"], relationships: [{ type: "prerequisite-of", target: "agent-evals" }] }],
  learningPath: [{ conceptId: "agent-orchestration", rank: 1, whyNow: "frontier", whatToLearn: "build a multi-agent loop",
    resources: [{ title: "docs", url: "https://x", verified: true }], project: "build an orchestrator" }],
  projectGaps: [{ theme: "agent eval harness", seenIn: ["alice/agent"], suggestion: "build one" }],
  positioning: { currentSignal: "researcher-leaning", evidence: ["papers"], targetSignal: "builder/shipper",
    gap: "research overshadows shipping", moves: ["foreground 0→1 work"] },
  baseline: { tools: ["fastapi", "pytorch"] },
};

describe("AnalysisResultSchema", () => {
  it("parses a valid result", () => {
    expect(AnalysisResultSchema.parse(sample).concepts[0].stage).toBe("current-frontier");
  });
  it("rejects an invalid stage", () => {
    expect(() => AnalysisResultSchema.parse({ ...sample, concepts: [{ ...sample.concepts[0], stage: "bogus" }] })).toThrow();
  });
});
