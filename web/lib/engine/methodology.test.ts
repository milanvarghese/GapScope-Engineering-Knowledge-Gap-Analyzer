import { describe, it, expect } from "vitest";
import { inferMethodologies, clusterMethodologies } from "./methodology";

describe("methodology", () => {
  it("infers per-readme via injected fn", async () => {
    const infer = async (text: string) => (text.includes("agent") ? ["mcp server", "rag"] : []);
    const tagged = await inferMethodologies(infer, [["alice/r", "alice", "an agent project"], ["bob/r", "bob", "plain"]]);
    expect(tagged).toContainEqual(["alice", "mcp server"]);
    expect(tagged.length).toBe(2);
  });
  it("clusters distinct owners, excludes baseline", () => {
    const items = clusterMethodologies([["alice", "mcp"], ["bob", "mcp"], ["alice", "rag"], ["alice", "transfer learning"]], ["transfer learning"]);
    const by = Object.fromEntries(items.map((i) => [i.id, i]));
    expect(by["transfer learning"]).toBeUndefined();
    expect(by["mcp"].frequency).toBe(2);
    expect(by["mcp"].kind).toBe("methodology");
  });
});
