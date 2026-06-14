import { describe, it, expect } from "vitest";
import { study } from "./_helpers";

describe("study", () => {
  it("builds a card with verified registry doc + projects", async () => {
    const deps = {
      pypiSummary: async () => "Build LLM apps",
      summarize: async () => "LangChain builds LLM applications.",
      verify: async () => true,
      projects: async () => ({ small: ["s"], big: ["b"] }),
    };
    const card = await study(deps, "langchain");
    expect(card.summary).toContain("LangChain");
    expect(card.docs[0].verified).toBe(true);
    expect(card.projects.small).toEqual(["s"]);
  });
  it("drops dead doc links", async () => {
    const deps = {
      pypiSummary: async () => null,
      summarize: async () => "x",
      verify: async () => false,
      projects: async () => ({ small: [], big: [] }),
    };
    expect((await study(deps, "ghost")).docs).toEqual([]);
  });
});
