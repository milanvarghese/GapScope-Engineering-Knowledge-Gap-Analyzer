import { describe, it, expect } from "vitest";
import { harvestUser } from "./github";

function repo(name: string, pushed: string, extra: object = {}) {
  return { name, full_name: `alice/${name}`, owner: { login: "alice" }, pushed_at: pushed, fork: false, archived: false, ...extra };
}

describe("harvestUser", () => {
  it("filters forks/archived/no-manifest, recency-first, top_n", async () => {
    const repos: any = {
      alice: [repo("fresh", "2026-06-01T00:00:00Z", { description: "An ML service", topics: ["python", "fastapi"] }),
              repo("forked", "2026-05-20T00:00:00Z", { fork: true }),
              repo("arch", "2026-05-19T00:00:00Z", { archived: true }), repo("nomani", "2026-05-18T00:00:00Z"),
              repo("older", "2026-04-01T00:00:00Z")],
    };
    const files: Record<string, string> = {
      "fresh:requirements.txt": "langchain\nfastapi\n",
      "older:package.json": '{"dependencies":{"react":"^18"}}',
    };
    const deps = {
      listRepos: async (u: string) => repos[u] ?? [],
      getFile: async (_o: string, r: string, p: string) => files[`${r}:${p}`] ?? null,
    };
    const out = await harvestUser(deps, "alice", { topN: 10 });
    expect(out.map((r) => r.fullName)).toEqual(["alice/fresh", "alice/older"]);
    expect(out[0].tools).toEqual(new Set(["langchain", "fastapi"]));
    expect(out[0].description).toBe("An ML service");
    expect(out[0].topics).toEqual(["python", "fastapi"]);
    expect(out[1].description).toBe("");
    expect(out[1].topics).toEqual([]);
  });
});
