import { describe, it, expect } from "vitest";
import { computeGaps } from "./gaps";
import type { ExtractedRepo } from "./types";

function erepo(owner: string, name: string, tools: string[], pushed: string): ExtractedRepo {
  return { fullName: `${owner}/${name}`, owner, pushedAt: new Date(pushed), tools: new Set(tools), description: "", topics: [] };
}

describe("computeGaps", () => {
  it("excludes baseline tools", () => {
    const t = [erepo("alice", "x", ["fastapi", "langchain"], "2026-06-01T00:00:00Z")];
    expect(computeGaps(t, ["fastapi"]).map((g) => g.id)).toEqual(["langchain"]);
  });
  it("frequency=distinct owners; weighted rank; sorted", () => {
    const t = [
      erepo("alice", "r1", ["langchain"], "2026-06-01T00:00:00Z"),
      erepo("alice", "r2", ["mcp"], "2026-06-20T00:00:00Z"),
      erepo("bob", "r3", ["langchain"], "2026-06-10T00:00:00Z"),
    ];
    const by = Object.fromEntries(computeGaps(t, []).map((g) => [g.id, g]));
    expect(by["langchain"].frequency).toBe(2);
    expect(by["mcp"].recencyScore).toBe(1.0);
    expect(by["langchain"].recencyScore).toBe(0.0);
    // 0.7*1 + 0.3*0 = 0.7 ; 0.7*0.5 + 0.3*1 = 0.65
    expect(by["langchain"].rankScore).toBe(0.7);
    expect(by["mcp"].rankScore).toBe(0.65);
    expect(computeGaps(t, []).map((g) => g.id)).toEqual(["langchain", "mcp"]);
  });
  it("single gap → recency 1, rank 1", () => {
    const g = computeGaps([erepo("a", "r", ["solo"], "2026-06-01T00:00:00Z")], [])[0];
    expect(g.recencyScore).toBe(1.0);
    expect(g.rankScore).toBe(1.0);
  });
});
