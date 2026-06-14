# Interactive App — Plan A: TS Engine + API Endpoints

> **For agentic workers:** implement task-by-task with TDD (Vitest). Run commands from `web/` with npm. Steps use `- [ ]`.

**Goal:** Port the tested Python gap engine to TypeScript inside the Next.js app and expose three Route Handlers (`/api/resume`, `/api/analyze`, `/api/study`) that power the interactive product.

**Architecture:** TS engine modules under `web/lib/engine/` mirror `src/gapscope/*.py` (same behavior, pinned by Vitest tests that mirror the Python tests). Route Handlers compose them; `/api/analyze` streams progress over SSE, bounded to fit Vercel Hobby's 60s cap. Secrets are server-side env vars. Stateless.

**Tech Stack:** Next.js 15 (App Router) + TypeScript, `@anthropic-ai/sdk`, `zod` (validate LLM JSON), `smol-toml` (parse pyproject), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-13-gapscope-interactive-app-design.md`. **Reference implementation:** the Python engine in `src/gapscope/` (already tested — port behavior faithfully).

**Working dir:** all paths are under `web/`. Run `cd web` first. Use the existing Next 15 app from Plan 3.

---

## Task 1: Test tooling + deps

**Files:** Modify `web/package.json`; create `web/vitest.config.ts`, `web/lib/engine/.gitkeep`.

- [ ] **Step 1:** In `web/`, install deps:
```bash
npm install @anthropic-ai/sdk zod smol-toml
npm install -D vitest
```
- [ ] **Step 2:** Add to `web/package.json` `"scripts"`: `"test": "vitest run"`.
- [ ] **Step 3:** Create `web/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", include: ["lib/**/*.test.ts"] } });
```
- [ ] **Step 4:** Verify: `npx vitest run` → exits cleanly (no tests yet / "no test files").
- [ ] **Step 5:** Commit: `git add -A && git commit -m "chore: add vitest + engine deps to web"`

---

## Task 2: manifests.ts (port of src/gapscope/manifests.py)

**Files:** Create `web/lib/engine/manifests.ts`, `web/lib/engine/manifests.test.ts`.

Read `src/gapscope/manifests.py` first — port its behavior exactly: `normalizePackageName`, `parseRequirements`, `parsePyproject` (use `smol-toml`'s `parse`), `parsePackageJson`, `parseManifest`, `MANIFEST_NAMES`, and `isDependencyDump` (requirements.txt with ≥80 names and ≥90% lines containing `==`).

- [ ] **Step 1 — failing test** `web/lib/engine/manifests.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  normalizePackageName, parseRequirements, parsePyproject,
  parsePackageJson, parseManifest, MANIFEST_NAMES, isDependencyDump,
} from "./manifests";

describe("manifests", () => {
  it("normalizes version/extras/case/markers", () => {
    expect(normalizePackageName("FastAPI==0.110.0")).toBe("fastapi");
    expect(normalizePackageName("uvicorn[standard]>=0.27")).toBe("uvicorn");
    expect(normalizePackageName("torch ; python_version >= '3.9'")).toBe("torch");
    expect(normalizePackageName("@anthropic-ai/sdk")).toBe("@anthropic-ai/sdk");
  });
  it("parses requirements ignoring noise", () => {
    const text = "# c\nFastAPI==0.110.0\nuvicorn[standard]>=0.27\nlangchain\n-r o.txt\n--index-url x\ntorch ; python_version >= '3.9'\n\n";
    expect(parseRequirements(text)).toEqual(new Set(["fastapi", "uvicorn", "langchain", "torch"]));
  });
  it("parses pyproject pep621 + optional", () => {
    const text = '[project]\nname="x"\ndependencies=["fastapi>=0.110","httpx","pydantic>=2"]\n[project.optional-dependencies]\ndev=["pytest"]\n';
    expect(parsePyproject(text)).toEqual(new Set(["fastapi", "httpx", "pydantic", "pytest"]));
  });
  it("parses package.json deps+dev", () => {
    const text = '{"dependencies":{"react":"^18","next":"14.0.0"},"devDependencies":{"typescript":"^5"}}';
    expect(parsePackageJson(text)).toEqual(new Set(["react", "next", "typescript"]));
  });
  it("dispatches and lists names", () => {
    expect(parseManifest("requirements.txt", "flask\n")).toEqual(new Set(["flask"]));
    expect(parseManifest("unknown.txt", "flask\n")).toEqual(new Set());
    expect(MANIFEST_NAMES).toContain("package.json");
  });
  it("detects pip-freeze dump", () => {
    const dump = Array.from({ length: 100 }, (_, i) => `pkg${i}==1.${i}`).join("\n");
    expect(isDependencyDump("requirements.txt", dump)).toBe(true);
    expect(isDependencyDump("requirements.txt", "flask\nfastapi==2.0\n")).toBe(false);
    expect(isDependencyDump("package.json", dump)).toBe(false);
  });
});
```
- [ ] **Step 2:** `npx vitest run lib/engine/manifests.test.ts` → fails (no module).
- [ ] **Step 3 — implement** `web/lib/engine/manifests.ts`:
```ts
import { parse as parseToml } from "smol-toml";

const SPLIT = /[<>=!~;[\s]/;

export function normalizePackageName(raw: string): string {
  return raw.trim().split(SPLIT)[0].trim().toLowerCase();
}

export function parseRequirements(text: string): Set<string> {
  const names = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#") || s.startsWith("-")) continue;
    const n = normalizePackageName(s);
    if (n) names.add(n);
  }
  return names;
}

export function parsePyproject(text: string): Set<string> {
  const data = parseToml(text) as any;
  const names = new Set<string>();
  const project = data.project ?? {};
  for (const dep of project.dependencies ?? []) names.add(normalizePackageName(String(dep)));
  for (const group of Object.values(project["optional-dependencies"] ?? {}))
    for (const dep of group as string[]) names.add(normalizePackageName(String(dep)));
  const poetry = data.tool?.poetry?.dependencies ?? {};
  for (const key of Object.keys(poetry)) if (key.toLowerCase() !== "python") names.add(normalizePackageName(key));
  names.delete("");
  return names;
}

export function parsePackageJson(text: string): Set<string> {
  const data = JSON.parse(text);
  const names = new Set<string>();
  for (const section of ["dependencies", "devDependencies"])
    for (const key of Object.keys(data[section] ?? {})) names.add(normalizePackageName(key));
  names.delete("");
  return names;
}

const PARSERS: Record<string, (t: string) => Set<string>> = {
  "requirements.txt": parseRequirements,
  "pyproject.toml": parsePyproject,
  "package.json": parsePackageJson,
};
export const MANIFEST_NAMES = Object.keys(PARSERS);

export function parseManifest(filename: string, text: string): Set<string> {
  const p = PARSERS[filename];
  return p ? p(text) : new Set<string>();
}

export function isDependencyDump(filename: string, text: string): boolean {
  if (filename !== "requirements.txt") return false;
  const names = parseRequirements(text);
  if (names.size < 80) return false;
  let pinned = 0;
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (s && !s.startsWith("#") && !s.startsWith("-") && s.includes("==")) pinned++;
  }
  return pinned / Math.max(names.size, 1) >= 0.9;
}
```
- [ ] **Step 4:** `npx vitest run lib/engine/manifests.test.ts` → all pass.
- [ ] **Step 5:** Commit: `git add -A && git commit -m "feat(web): port manifest parsers to TS"`

---

## Task 3: denoise.ts (port of src/gapscope/denoise.py)

**Files:** Create `web/lib/engine/denoise-data.ts`, `web/lib/engine/denoise.ts`, `web/lib/engine/denoise.test.ts`.

`denoise-data.ts` embeds the data from `config/tool_denylist.yaml` + `config/tool_groups.yaml` as TS constants (read those files; reproduce their contents).

- [ ] **Step 1 — failing test** `web/lib/engine/denoise.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { applyDenoise, type DenoiseRules } from "./denoise";

const RULES: DenoiseRules = {
  denylistExact: new Set(["postcss", "autoprefixer", "eslint"]),
  denylistPrefix: ["@types/"],
  groups: { "@radix-ui/react-dialog": "shadcn/ui", "clsx": "shadcn/ui", "@radix-ui/react-tabs": "shadcn/ui" },
};

describe("denoise", () => {
  it("drops exact + prefix denylist", () => {
    expect(applyDenoise(new Set(["react", "postcss", "@types/node", "fastapi"]), RULES))
      .toEqual(new Set(["react", "fastapi"]));
  });
  it("folds a family to one group", () => {
    expect(applyDenoise(new Set(["@radix-ui/react-dialog", "@radix-ui/react-tabs", "clsx", "react"]), RULES))
      .toEqual(new Set(["shadcn/ui", "react"]));
  });
});
```
- [ ] **Step 2:** run → fails.
- [ ] **Step 3 — implement** `web/lib/engine/denoise.ts`:
```ts
export type DenoiseRules = {
  denylistExact: Set<string>;
  denylistPrefix: string[];
  groups: Record<string, string>;
};

export function applyDenoise(tools: Set<string>, rules: DenoiseRules): Set<string> {
  const out = new Set<string>();
  for (const tool of tools) {
    const t = tool.toLowerCase();
    if (rules.denylistExact.has(t) || rules.denylistPrefix.some((p) => t.startsWith(p))) continue;
    out.add(rules.groups[t] ?? t);
  }
  return out;
}
```
And `web/lib/engine/denoise-data.ts` — reproduce denylist/groups from the two `config/*.yaml` files as a `DEFAULT_DENOISE: DenoiseRules` constant (exact set, prefix `["@types/"]`, and the full shadcn/ui group member→group map; lowercase all keys).
- [ ] **Step 4:** run → pass.
- [ ] **Step 5:** Commit: `git add -A && git commit -m "feat(web): port denoise (denylist+grouping) to TS"`

---

## Task 4: gaps.ts (port of src/gapscope/gaps.py)

**Files:** Create `web/lib/engine/types.ts`, `web/lib/engine/gaps.ts`, `web/lib/engine/gaps.test.ts`.

`types.ts` defines the engine-internal `ExtractedRepo = { fullName: string; owner: string; pushedAt: Date; tools: Set<string> }`. The output `Gap` type matches `web/lib/types.ts` (the dashboard contract). Port `computeGaps(targetRepos, baselineTools, denoiseRules?)` with `rankScore = round(0.7*normFreq + 0.3*normRecency, 4)`, baseline subtraction (case-insensitive), evidence capped at 5, sorted desc.

- [ ] **Step 1 — failing test** `web/lib/engine/gaps.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { computeGaps } from "./gaps";
import type { ExtractedRepo } from "./types";

function erepo(owner: string, name: string, tools: string[], pushed: string): ExtractedRepo {
  return { fullName: `${owner}/${name}`, owner, pushedAt: new Date(pushed), tools: new Set(tools) };
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
```
- [ ] **Step 2:** run → fails.
- [ ] **Step 3 — implement** `web/lib/engine/types.ts` and `web/lib/engine/gaps.ts`. Port `compute_gaps` from `src/gapscope/gaps.py`: aggregate per lowercased tool not in baseline → `{owners:Set, repos:string[], recent:Date}`; `normFreq = freq/maxFreq`; `normRecency = span===0 ? 1 : (recent-minT)/(maxT-minT)`; `rankScore = round(0.7*normFreq + 0.3*normRecency, 4)`; `recencyScore = round(normRecency, 4)`; evidence = first 5 unique repos `{repo, signal:"dependency"}`; `kind:"tool"`, empty `docs`/`projects`/`research`; sort by `(rankScore, frequency)` desc. Use a `round4(x)=Math.round(x*1e4)/1e4` helper.
- [ ] **Step 4:** run → pass.
- [ ] **Step 5:** Commit: `git add -A && git commit -m "feat(web): port gap computer + ranker to TS"`

---

## Task 5: github.ts (fetch client + harvest)

**Files:** Create `web/lib/engine/github.ts`, `web/lib/engine/github.test.ts`.

Mirror `src/gapscope/github_client.py` + `harvester.py`. `harvestUser(deps, username, opts)` where `deps = { listRepos, getFile }` (injectable for tests). Recency-first (API returns pushed-desc), skip forks/archived, skip dump manifests, skip repos with no tools, cap at `topN`.

- [ ] **Step 1 — failing test** `web/lib/engine/github.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { harvestUser } from "./github";

function repo(name: string, pushed: string, extra: object = {}) {
  return { name, full_name: `alice/${name}`, owner: { login: "alice" }, pushed_at: pushed, fork: false, archived: false, ...extra };
}

describe("harvestUser", () => {
  it("filters forks/archived/no-manifest, recency-first, top_n", async () => {
    const repos: any = {
      alice: [repo("fresh", "2026-06-01T00:00:00Z"), repo("forked", "2026-05-20T00:00:00Z", { fork: true }),
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
  });
});
```
- [ ] **Step 2:** run → fails.
- [ ] **Step 3 — implement** `web/lib/engine/github.ts`:
```ts
import { parseManifest, isDependencyDump, MANIFEST_NAMES } from "./manifests";
import type { ExtractedRepo } from "./types";

const API = "https://api.github.com";

export type GithubDeps = {
  listRepos: (username: string) => Promise<any[]>;
  getFile: (owner: string, repo: string, path: string) => Promise<string | null>;
};

export function realGithub(token?: string): GithubDeps {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return {
    async listRepos(username) {
      const r = await fetch(`${API}/users/${username}/repos?sort=pushed&direction=desc&per_page=100`, { headers });
      if (!r.ok) throw new Error(`${r.status} listing ${username}`);
      return r.json();
    },
    async getFile(owner, repo, path) {
      const r = await fetch(`${API}/repos/${owner}/${repo}/contents/${path}`, { headers });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`${r.status} fetching ${repo}/${path}`);
      const data = await r.json();
      return Buffer.from(data.content, "base64").toString("utf-8");
    },
  };
}

export async function harvestUser(
  deps: GithubDeps,
  username: string,
  opts: { topN?: number; manifests?: string[] } = {},
): Promise<ExtractedRepo[]> {
  const topN = opts.topN ?? 5;
  const manifests = opts.manifests ?? MANIFEST_NAMES;
  const out: ExtractedRepo[] = [];
  for (const repo of await deps.listRepos(username)) {
    if (repo.fork || repo.archived) continue;
    const tools = new Set<string>();
    for (const m of manifests) {
      const text = await deps.getFile(repo.owner.login, repo.name, m);
      if (text && !isDependencyDump(m, text)) for (const t of parseManifest(m, text)) tools.add(t);
    }
    if (tools.size === 0) continue;
    out.push({ fullName: repo.full_name, owner: username, pushedAt: new Date(repo.pushed_at), tools });
    if (out.length >= topN) break;
  }
  return out;
}
```
- [ ] **Step 4:** run → pass.
- [ ] **Step 5:** Commit: `git add -A && git commit -m "feat(web): GitHub fetch client + recency-first harvester"`

---

## Task 6: anthropic.ts (Claude wrapper: JSON extract + résumé PDF)

**Files:** Create `web/lib/engine/anthropic.ts`, `web/lib/engine/anthropic.test.ts`.

Two functions, both taking an injectable `client` (the `@anthropic-ai/sdk` `Anthropic` instance) so tests stub it. `extractJSON<T>(client, {system, user, schema})` — calls `client.messages.create` (model `claude-haiku-4-5`, max_tokens 1024) instructing JSON-only output, parses the first text block as JSON, validates with the passed Zod `schema`, returns the parsed value. `extractSkillsFromPdf(client, base64Pdf)` — sends a document content block (`{type:"document", source:{type:"base64", media_type:"application/pdf", data}}`) + a text instruction; returns `{tools: string[]}` validated by Zod.

- [ ] **Step 1 — failing test** `web/lib/engine/anthropic.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { extractJSON } from "./anthropic";

function fakeClient(jsonText: string) {
  return { messages: { create: async () => ({ content: [{ type: "text", text: jsonText }] }) } } as any;
}

describe("extractJSON", () => {
  it("parses and validates JSON from the text block", async () => {
    const client = fakeClient('{"tools":["fastapi","langchain"]}');
    const out = await extractJSON(client, {
      system: "s", user: "u", schema: z.object({ tools: z.array(z.string()) }),
    });
    expect(out.tools).toEqual(["fastapi", "langchain"]);
  });
  it("strips code fences if present", async () => {
    const client = fakeClient('```json\n{"tools":["x"]}\n```');
    const out = await extractJSON(client, { system: "s", user: "u", schema: z.object({ tools: z.array(z.string()) }) });
    expect(out.tools).toEqual(["x"]);
  });
});
```
- [ ] **Step 2:** run → fails.
- [ ] **Step 3 — implement** `web/lib/engine/anthropic.ts`:
```ts
import Anthropic from "@anthropic-ai/sdk";
import type { ZodType } from "zod";

export const MODEL = "claude-haiku-4-5";

function firstText(msg: any): string {
  const block = (msg.content ?? []).find((b: any) => b.type === "text");
  let t = (block?.text ?? "").trim();
  if (t.startsWith("```")) t = t.replace(/^```(?:json)?\s*/i, "").replace(/```$/m, "").trim();
  return t;
}

export async function extractJSON<T>(
  client: Anthropic,
  { system, user, schema }: { system: string; user: string; schema: ZodType<T> },
): Promise<T> {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: system + " Respond with ONLY valid minified JSON, no prose, no code fences.",
    messages: [{ role: "user", content: user }],
  });
  return schema.parse(JSON.parse(firstText(msg)));
}

export async function extractSkillsFromPdf(client: Anthropic, base64Pdf: string): Promise<string[]> {
  const { z } = await import("zod");
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: "Extract the engineering tools, libraries, languages, and platforms this person knows from their résumé. Respond with ONLY valid minified JSON: {\"tools\": string[]}. Lowercase, deduplicated, no prose.",
    messages: [{
      role: "user",
      content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64Pdf } },
        { type: "text", text: "Extract the tools/skills." },
      ],
    }],
  });
  const block = (msg.content ?? []).find((b: any) => b.type === "text");
  let t = (block?.text ?? "").trim();
  if (t.startsWith("```")) t = t.replace(/^```(?:json)?\s*/i, "").replace(/```$/m, "").trim();
  return z.object({ tools: z.array(z.string()) }).parse(JSON.parse(t)).tools.map((s) => s.toLowerCase());
}
```
- [ ] **Step 4:** run → pass.
- [ ] **Step 5:** Commit: `git add -A && git commit -m "feat(web): Claude wrapper (JSON extract + résumé PDF)"`

---

## Task 7: methodology.ts (port of src/gapscope/methodology.py)

**Files:** Create `web/lib/engine/methodology.ts`, `web/lib/engine/methodology.test.ts`.

`inferMethodologies(infer, readmes)` where `infer(readmeText) => Promise<string[]>` is injected (wraps a Claude call). Returns `[owner, tag][]` normalized. `clusterMethodologies(tagged, baselineMethods)` → methodology `Gap[]` (kind "methodology", `rankScore = round(0.7*freq/maxFreq + 0.3, 4)`, recency 1.0, empty evidence), baseline methods excluded, sorted desc.

- [ ] **Step 1 — failing test** `web/lib/engine/methodology.test.ts`:
```ts
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
```
- [ ] **Step 2:** run → fails.
- [ ] **Step 3 — implement** `web/lib/engine/methodology.ts`. `inferMethodologies`: for each `[fullName, owner, text]`, call `infer(text)`, normalize each tag (`tag.toLowerCase().split(/\s+/).join(" ")`), push `[owner, tag]` if non-empty. `clusterMethodologies`: aggregate owners per tag (skip baseline methods lowercased); `maxFreq`; build `Gap` with `frequency`, `recencyScore:1`, `rankScore: round4(0.7*freq/maxFreq + 0.3)`, `kind:"methodology"`, empty `evidence`/`docs`/`research`, `projects:{small:[],big:[]}`; sort `(rankScore, frequency)` desc. Reuse the `round4` helper (import from `gaps.ts` or redefine).
- [ ] **Step 4:** run → pass.
- [ ] **Step 5:** Commit: `git add -A && git commit -m "feat(web): port methodology inference + clustering to TS"`

---

## Task 8: config.ts (defaults + bounds)

**Files:** Create `web/lib/engine/config.ts`.

- [ ] **Step 1 — implement** `web/lib/engine/config.ts`:
```ts
// Editable default engineer sets per role. Users can override with custom handles in the UI.
export const DEFAULT_PEOPLE: Record<string, string[]> = {
  "ai-engineer": ["Tony363", "nolanmak", "Lightheartdevs", "choprahetarth", "krypticmouse"],
  "devops": [],
  "security": [],
};

// Curated tool -> official docs URL (deterministic, always correct for common tools).
export const DOCS_REGISTRY: Record<string, string> = {
  fastapi: "https://fastapi.tiangolo.com",
  langchain: "https://python.langchain.com",
  docker: "https://docs.docker.com",
  pytest: "https://docs.pytest.org",
  ruff: "https://docs.astral.sh/ruff/",
  pydantic: "https://docs.pydantic.dev",
};

// Bounding to fit Vercel Hobby's 60s function cap (see spec §4).
export const BOUNDS = { MAX_PEOPLE: 6, MAX_REPOS_PER_PERSON: 5, MAX_READMES: 8, CONCURRENCY: 5 };
```
*(The `ai-engineer` defaults seed Milan's five — editable; if the repo is public and that's unwanted, swap for well-known public handles.)*
- [ ] **Step 2:** Commit: `git add -A && git commit -m "feat(web): engine config (default people, docs registry, bounds)"`

---

## Task 9: /api/resume route

**Files:** Create `web/app/api/resume/route.ts`, `web/app/api/resume/route.test.ts`.

Accepts multipart `file` (PDF), base64-encodes it, calls `extractSkillsFromPdf`, returns `{tools}`. Reads `ANTHROPIC_API_KEY` from env; 500 with clear message if absent. `export const runtime = "nodejs"` and `export const maxDuration = 30`.

- [ ] **Step 1 — failing test** `web/app/api/resume/route.test.ts` (test the pure handler logic by extracting it). Implement the route so its core is a testable function `parseResume(client, base64): Promise<{tools:string[]}>` in the route file, exported. Test:
```ts
import { describe, it, expect } from "vitest";
import { parseResume } from "./route";

const fakeClient = { messages: { create: async () => ({ content: [{ type: "text", text: '{"tools":["FastAPI","Docker"]}' }] }) } } as any;

describe("parseResume", () => {
  it("returns lowercased tools", async () => {
    expect(await parseResume(fakeClient, "BASE64")).toEqual({ tools: ["fastapi", "docker"] });
  });
});
```
- [ ] **Step 2:** run → fails.
- [ ] **Step 3 — implement** `web/app/api/resume/route.ts`:
```ts
import Anthropic from "@anthropic-ai/sdk";
import { extractSkillsFromPdf } from "@/lib/engine/anthropic";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function parseResume(client: Anthropic, base64: string): Promise<{ tools: string[] }> {
  return { tools: await extractSkillsFromPdf(client, base64) };
}

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: "Server not configured (ANTHROPIC_API_KEY)" }, { status: 500 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No PDF uploaded" }, { status: 400 });
  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  try {
    const result = await parseResume(new Anthropic({ apiKey: key }), base64);
    return Response.json(result);
  } catch (e: any) {
    return Response.json({ error: `Could not read résumé: ${e.message}` }, { status: 422 });
  }
}
```
Ensure `web/tsconfig.json` has the `@/*` path alias (Plan 3 scaffold should already; if not, add `"paths": {"@/*": ["./*"]}`).
- [ ] **Step 4:** run → pass; then `npm run build` → passes.
- [ ] **Step 5:** Commit: `git add -A && git commit -m "feat(web): /api/resume — résumé PDF → skills"`

---

## Task 10: /api/analyze route (SSE, bounded, concurrent)

**Files:** Create `web/app/api/analyze/route.ts`, `web/app/api/analyze/route.test.ts`.

Body JSON: `{ baseline: {tools: string[]}, handles: string[], role?: string }`. Returns an SSE stream of `data: {type:"progress", message}` events then `data: {type:"result", report}`. Core logic in an exported async generator `runAnalysis(deps, body)` yielding events, so it's testable without HTTP. `deps = { harvest(user), inferReadme(text), listReadmes(repos) }` injected. Bounded by `BOUNDS`. The route wires real deps (`realGithub(token)`, Claude `infer`) and pipes the generator to a `ReadableStream`.

- [ ] **Step 1 — failing test** `web/app/api/analyze/route.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { runAnalysis } from "./route";
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
```
- [ ] **Step 2:** run → fails.
- [ ] **Step 3 — implement** `web/app/api/analyze/route.ts`. Define `AnalyzeDeps = { harvest(user):Promise<ExtractedRepo[]>; readmesFor(repos):Promise<[string,string,string][]>; inferReadme(text):Promise<string[]> }`. `runAnalysis(deps, body)` async generator:
  1. yield `{type:"progress", message:"Reading targets…"}`.
  2. Slice handles to `BOUNDS.MAX_PEOPLE`. For each (bounded concurrency `BOUNDS.CONCURRENCY`), `harvest`; yield a progress per person (`harvested <user> (<n> repos)`); collect repos; on throw yield `{type:"progress", message:"skipped <user>: <err>"}`.
  3. yield progress "Inferring methodologies…"; `readmesFor(allRepos)` capped at `BOUNDS.MAX_READMES`; `inferMethodologies(deps.inferReadme, readmes)`.
  4. `computeGaps(allRepos, baseline.tools, DEFAULT_DENOISE)` + `clusterMethodologies(tagged, [])`; concat; sort by `(rankScore, frequency)` desc.
  5. yield `{type:"result", report: {meta:{generatedAt:new Date().toISOString(), role, targetsAnalyzed: distinctOwners}, baseline, gaps}}`.
  The `POST` handler: validate env (`ANTHROPIC_API_KEY`, `GITHUB_TOKEN`), build real deps (`harvest` = `harvestUser(realGithub(token), u, {topN:MAX_REPOS_PER_PERSON})`; `inferReadme` = Claude call returning string[] via `extractJSON` with a `{tags:string[]}` schema → `.tags`; `readmesFor` = fetch README.md per repo via `realGithub`), and stream the generator as `text/event-stream` (`new ReadableStream({ async start(controller){ for await (const e of runAnalysis(...)) controller.enqueue(encoder.encode("data: "+JSON.stringify(e)+"\n\n")); controller.close(); } })`). `export const runtime="nodejs"; export const maxDuration=60;`. On missing env return JSON 500.
- [ ] **Step 4:** run test → pass; `npm run build` → passes.
- [ ] **Step 5:** Commit: `git add -A && git commit -m "feat(web): /api/analyze — bounded SSE gap analysis"`

---

## Task 11: /api/study route (lazy per-gap research)

**Files:** Create `web/app/api/study/route.ts`, `web/app/api/study/route.test.ts`.

`GET ?tool=<id>` → `{summary, docs, projects}`. Core testable fn `study(deps, tool)` with injected `deps = { pypiSummary(name):Promise<string|null>; summarize(tool,meta):Promise<string>; verify(url):Promise<boolean>; projects(tool,summary):Promise<{small,big}> }`. Docs: `DOCS_REGISTRY[tool]` then `https://pypi.org/project/<tool>/` fallback, each `verify`-checked; dead → dropped.

- [ ] **Step 1 — failing test** `web/app/api/study/route.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { study } from "./route";

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
```
- [ ] **Step 2:** run → fails.
- [ ] **Step 3 — implement** `web/app/api/study/route.ts`. `study(deps, tool)`: `meta = await deps.pypiSummary(tool)`; `summary = meta ? await deps.summarize(tool, meta) : tool+": no registry description found."`; build doc candidates `[DOCS_REGISTRY[tool] (if present), https://pypi.org/project/<tool>/]`, keep the first that `await deps.verify(url)` returns true → `[{title:`${tool} docs`, url, verified:true}]` else `[]`; `projects = await deps.projects(tool, summary)`; return `{summary, docs, projects}`. The `GET` handler reads `tool` from query, validates env, wires real deps (pypiSummary = fetch `https://pypi.org/pypi/<tool>/json` → `.info.summary`; summarize/projects = Claude via `extractJSON`; verify = `fetch(url,{method:"GET"}).ok` in try/catch → false on error), returns `Response.json`. `export const runtime="nodejs"; export const maxDuration=30;`.
- [ ] **Step 4:** run → pass; `npm run build` → passes.
- [ ] **Step 5:** Commit: `git add -A && git commit -m "feat(web): /api/study — lazy per-gap research"`

---

## Self-Review

- §2 endpoints (`/api/resume`, `/api/analyze`, `/api/study`) → Tasks 9, 10, 11. ✅
- §2 engine modules (manifests, denoise, gaps, github, anthropic, methodology, config) → Tasks 2–8. ✅
- §3 data shapes — `Gap` matches `web/lib/types.ts`; `/api/resume` `{tools}`; `/api/study` `{summary,docs,projects}`. ✅
- §4 bounding (MAX_PEOPLE/REPOS/READMES, concurrency, maxDuration=60) → Task 8 + Task 10. ✅
- §5 error handling — env checks (Tasks 9–11), per-person skip (Task 10), résumé failure 422 (Task 9). ✅
- §6 testing — Vitest units mirror Python tests (Tasks 2–7); route core fns tested (9–11); `npm run build` gate (9–11). ✅
- **Frontend (§1 setup screen, progress feed, results) → Plan B**, not here. ✅
- **Type consistency:** `ExtractedRepo` ({fullName,owner,pushedAt,tools}) consistent across Tasks 4/5/7/10; `Gap` from `web/lib/types.ts` is the single output type; `GithubDeps`/`AnalyzeDeps`/study `deps` shapes match their tests. `round4` defined in `gaps.ts`, reused in `methodology.ts`. ✅
- **Placeholder scan:** ports reference the exact Python file to mirror (authoritative source, not a placeholder) + complete Vitest tests pin behavior; new endpoint logic has full code. ✅

**Documented decision:** engine ports cite `src/gapscope/*.py` as the behavior spec rather than re-deriving — the Python is already tested, and the Vitest cases mirror the Python cases, so the port is verified, not guessed.
