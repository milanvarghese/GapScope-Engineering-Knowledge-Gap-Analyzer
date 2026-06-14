import { describe, it, expect } from "vitest";
import { runAnalysis } from "./_helpers";
import type { ExtractedRepo } from "@/lib/engine/types";

function erepo(owner: string, name: string, tools: string[]): ExtractedRepo {
  return { fullName: `${owner}/${name}`, owner, pushedAt: new Date("2026-06-01T00:00:00Z"), tools: new Set(tools) };
}

describe("runAnalysis", () => {
  it("streams progress then a result with tool + methodology gaps", async () => {
    const deps = {
      harvest: async (u: string) => (u === "alice" ? [erepo("alice", "agent", ["fastapi", "langchain"])] : []),
      readmesFor: async (_repos: ExtractedRepo[]) => [["alice/agent", "alice", "an agent project"]] as [string, string, string][],
      inferReadme: async (text: string) => (text.includes("agent") ? ["mcp server"] : []),
    };
    const events: any[] = [];
    for await (const e of runAnalysis(deps, { baseline: { tools: ["fastapi"] }, handles: ["alice"], role: "ai-engineer" }))
      events.push(e);
    const result = events.find((e) => e.type === "result");
    expect(events.some((e) => e.type === "progress")).toBe(true);
    const ids = result.report.gaps.map((g: any) => g.id);
    expect(ids).toContain("langchain");      // tool gap (fastapi filtered by baseline)
    expect(ids).toContain("mcp server");      // methodology gap
    expect(ids).not.toContain("fastapi");
  });
});
