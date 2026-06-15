# Goal-Directed Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. TDD with Vitest; run from `web/`. Steps use `- [ ]`.

**Goal:** Replace the package-diff output with goal-directed LLM synthesis: given a résumé + your GitHub + a goal + target engineers, produce a concept map (with field trajectory), a sequenced learning path, project gaps, and a positioning read — rendered in the app, runnable locally.

**Architecture:** Reuse the harvest engine as an *evidence* layer (now also capturing repo title/description and the user's own repos for baseline). A new `synthesis.ts` makes one structured LLM call (Sonnet) → a Zod-validated `AnalysisResult` graph; code post-processes (verify resource links, order the learning path). `/api/analyze` orchestrates; the results UI is reworked to render the new schema.

**Tech Stack:** Next.js 15 / TS, `@anthropic-ai/sdk`, `zod`, Vitest. Reuses `github.ts`, `manifests.ts`, `anthropic.ts`, `links` verification, existing components.

**Spec:** `docs/superpowers/specs/2026-06-13-gapscope-goal-directed-analysis-design.md`.
**Run dir:** `web/`. **Local run:** `web/.env.local` with `ANTHROPIC_API_KEY` + `GITHUB_TOKEN`, then `npm run dev`.

---

## Task 1: Result types + Zod schema

**Files:** Create `web/lib/result-types.ts`, `web/lib/engine/result-schema.ts`, `web/lib/engine/result-schema.test.ts`.

- [ ] **Step 1 — failing test** `web/lib/engine/result-schema.test.ts`:
```ts
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
```
- [ ] **Step 2:** run → fails.
- [ ] **Step 3 — implement** `web/lib/result-types.ts` (TS interfaces) and `web/lib/engine/result-schema.ts` (Zod, deriving the same shape). Types:
```ts
// result-types.ts
export type Stage = "fading" | "table-stakes" | "current-frontier" | "emerging";
export type Have = "solid" | "partial" | "missing";
export interface ConceptRel { type: "supersedes" | "prerequisite-of" | "related"; target: string; }
export interface Concept { id: string; name: string; stage: Stage; youHave: Have; importanceForGoal: number; evidence: string[]; relationships: ConceptRel[]; }
export interface Resource { title: string; url: string; verified: boolean; }
export interface PathStep { conceptId: string; rank: number; whyNow: string; whatToLearn: string; resources: Resource[]; project: string; }
export interface ProjectGap { theme: string; seenIn: string[]; suggestion: string; }
export interface Positioning { currentSignal: string; evidence: string[]; targetSignal: string; gap: string; moves: string[]; }
export interface AnalysisResult {
  goal: string; generatedAt: string; targetsAnalyzed: number; summary: string;
  concepts: Concept[]; learningPath: PathStep[]; projectGaps: ProjectGap[];
  positioning: Positioning; baseline: { tools: string[] };
}
```
```ts
// result-schema.ts
import { z } from "zod";
const Stage = z.enum(["fading", "table-stakes", "current-frontier", "emerging"]);
const Have = z.enum(["solid", "partial", "missing"]);
const ConceptRel = z.object({ type: z.enum(["supersedes", "prerequisite-of", "related"]), target: z.string() });
export const ConceptSchema = z.object({ id: z.string(), name: z.string(), stage: Stage, youHave: Have, importanceForGoal: z.number(), evidence: z.array(z.string()), relationships: z.array(ConceptRel) });
export const ResourceSchema = z.object({ title: z.string(), url: z.string(), verified: z.boolean() });
export const PathStepSchema = z.object({ conceptId: z.string(), rank: z.number(), whyNow: z.string(), whatToLearn: z.string(), resources: z.array(ResourceSchema), project: z.string() });
export const PositioningSchema = z.object({ currentSignal: z.string(), evidence: z.array(z.string()), targetSignal: z.string(), gap: z.string(), moves: z.array(z.string()) });
export const AnalysisResultSchema = z.object({
  goal: z.string(), generatedAt: z.string(), targetsAnalyzed: z.number(), summary: z.string(),
  concepts: z.array(ConceptSchema), learningPath: z.array(PathStepSchema),
  projectGaps: z.array(z.object({ theme: z.string(), seenIn: z.array(z.string()), suggestion: z.string() })),
  positioning: PositioningSchema, baseline: z.object({ tools: z.array(z.string()) }),
});
```
- [ ] **Step 4:** run → pass. **Step 5:** commit `feat(web): goal-directed result types + zod schema`.

---

## Task 2: Capture repo title/description/topics in harvest

**Files:** Modify `web/lib/engine/types.ts` (extend `ExtractedRepo`), `web/lib/engine/github.ts`, `web/lib/engine/github.test.ts`.

- [ ] **Step 1 — update test:** in `github.test.ts`, give a fixture repo a `description` + `topics`, and assert the returned `ExtractedRepo` carries `description` and `topics`. (Keep existing filter/order assertions.)
- [ ] **Step 2:** run → fails.
- [ ] **Step 3 — implement:** Add to `ExtractedRepo` in `types.ts`: `description: string; topics: string[];`. In `harvestUser` (github.ts), when building each kept `ExtractedRepo`, set `description: repo.description ?? ""` and `topics: repo.topics ?? []` (both come from the listRepos response — no extra calls).
- [ ] **Step 4:** run → pass. **Step 5:** commit `feat(web): capture repo title/description/topics as project signal`.

---

## Task 3: Goal presets

**Files:** Create `web/lib/engine/goals.ts`.

- [ ] **Step 1 — implement:**
```ts
export interface GoalPreset { id: string; label: string; expectedSignal: string; defaultHandles: string[]; }
export const GOAL_PRESETS: GoalPreset[] = [
  { id: "founding-engineer", label: "Founding Engineer", expectedSignal: "builder/shipper/owner who takes products 0→1 and owns infra", defaultHandles: ["tiangolo", "mckaywrigley", "hwchase17"] },
  { id: "forward-deployed-engineer", label: "Forward-Deployed Engineer", expectedSignal: "pragmatic builder who ships customer-facing solutions fast", defaultHandles: ["tiangolo", "simonw", "mckaywrigley"] },
  { id: "faang-google", label: "FAANG / Google ML Engineer", expectedSignal: "depth in systems + ML at scale, rigor, fundamentals", defaultHandles: ["karpathy", "tiangolo", "samuelcolvin"] },
  { id: "ai-research-engineer", label: "AI Research Engineer", expectedSignal: "frontier ML methods, experimentation, reproducible research", defaultHandles: ["karpathy", "hwchase17", "lucidrains"] },
];
export function presetById(id: string): GoalPreset | undefined { return GOAL_PRESETS.find((g) => g.id === id); }
```
- [ ] **Step 2:** commit `feat(web): goal presets (personas + default exemplars)`.

---

## Task 4: Synthesis core (LLM call + ordering + link verification)

**Files:** Create `web/lib/engine/synthesis.ts`, `web/lib/engine/synthesis.test.ts`.

Define `SynthesisInput = { goal: string; expectedSignal: string; baselineTools: string[]; yourProjects: {name:string;description:string}[]; targets: {handle:string; tools:string[]; methodologies:string[]; projects:{name:string;description:string}[]}[] }`. `synthesize(deps, input)` where `deps = { generate(prompt:{system,user}):Promise<unknown>; verify(url):Promise<boolean> }` — `generate` returns the raw JSON object (the route wires it to Claude via `extractJSON` with `AnalysisResultSchema`-shaped guidance), `verify` is link verification. The function: validates the raw object against `AnalysisResultSchema`, then (a) drops unverified resource links, (b) orders `learningPath` by `stageWeight(stage) * importanceForGoal` desc with prerequisite-before-dependent enforced, re-assigning `rank` 1..N. `stageWeight`: `current-frontier:4, emerging:3, table-stakes:2, fading:1`.

- [ ] **Step 1 — failing test** `web/lib/engine/synthesis.test.ts`:
```ts
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
```
- [ ] **Step 2:** run → fails.
- [ ] **Step 3 — implement** `synthesis.ts`:
  - `STAGE_WEIGHT = { "current-frontier": 4, emerging: 3, "table-stakes": 2, fading: 1 }`.
  - `orderLearningPath(concepts, path)`: build a map conceptId→concept; score each step by `STAGE_WEIGHT[stage] * importanceForGoal`; sort desc; then a stable pass that, for any concept that is a `prerequisite-of` another in the path, ensures it precedes its dependent (simple: repeatedly bubble a prerequisite above its dependent until stable, cap iterations at path.length²); reassign `rank = index+1`; return new array.
  - `buildSystemPrompt(input)` + `buildUserPrompt(input)`: instruct the model to act as a career-gap analyst; given the goal, the expected signal, the user's baseline tools + own project titles/descriptions, and the targets' tools/methodologies/project titles, produce the `AnalysisResult` JSON (describe each field, emphasize: stage reflects the *field trajectory* incl. fading; `youHave` positions the user from baseline; `positioning` compares the user's *signal* (researcher vs builder etc.) to `expectedSignal`; `projectGaps` from comparing target project themes to the user's; resources are real official docs URLs). Respond JSON only.
  - `synthesize(deps, input)`: `const rawObj = await deps.generate({ system: buildSystemPrompt(input), user: buildUserPrompt(input) }); const parsed = AnalysisResultSchema.parse(rawObj);` then verify links concurrently (`mapPool` over all resources) keeping only verified (set `verified:true`), then `parsed.learningPath = orderLearningPath(parsed.concepts, parsed.learningPath)`; return parsed.
- [ ] **Step 4:** run → pass. **Step 5:** commit `feat(web): synthesis — LLM concept graph + ordered learning path + verified links`.

---

## Task 5: /api/analyze rework

**Files:** Modify `web/app/api/analyze/route.ts`, `web/app/api/analyze/_helpers.ts` (or replace), `web/app/api/analyze/route.test.ts`.

Body JSON: `{ resumeSkills: string[]; githubUsername: string; goal: string; handles: string[] }`. Flow: harvest `githubUsername` (own repos) → baseline tools = `resumeSkills ∪ ownTools`; collect `yourProjects` = own repos' {name,description}. Harvest each target handle (bounded) → tools, methodology tags (via README+LLM), projects. Build `SynthesisInput` (expectedSignal from `presetById(goal)` or a generic builder default for free-text). Call `synthesize`. Return the `AnalysisResult` JSON. Core in an exported `runGoalAnalysis(deps, body)` for testing.

- [ ] **Step 1 — failing test** `route.test.ts`: stub `deps = { harvest(user), inferReadme(text), synthesize(input) }`; assert `runGoalAnalysis` returns a result whose `concepts` include an expected id and `positioning` is present, and that own-repo tools merge into `baseline.tools`. (Use a canned synthesize stub returning a valid AnalysisResult.)
- [ ] **Step 2:** run → fails.
- [ ] **Step 3 — implement:** `runGoalAnalysis(deps, body)` orchestrates as above (no HTTP). `POST`: validate env (`ANTHROPIC_API_KEY` + `GITHUB_TOKEN` → 500 JSON error), wire real deps (`harvest` = `harvestUser(realGithub(token), u, {topN: BOUNDS.MAX_REPOS_PER_PERSON})`; `inferReadme` via `extractJSON` `{tags}`; `synthesize` = the Task-4 fn with `generate` = `extractJSON` using Sonnet model `claude-sonnet-4-6` and `verify` = link check), `const result = await runGoalAnalysis(deps, body); return Response.json(result)`. Catch → `{error}` 500. `runtime="nodejs"; maxDuration=60`.
- [ ] **Step 4:** run test → pass; `npm run build` → passes. **Step 5:** commit `feat(web): /api/analyze produces goal-directed analysis`.

---

## Task 6: Setup screen — GitHub username + goal selector

**Files:** Modify `web/app/AnalyzerApp.tsx`, setup components (e.g. `web/components/TargetPicker.tsx` or the setup form); reuse `SkillChips`. Add a `GitHub username` text input and a `Goal` selector (dropdown of `GOAL_PRESETS` + a free-text option). When a preset is chosen, prefill the target handles with its `defaultHandles` (still editable). On Analyze, POST `{ resumeSkills, githubUsername, goal, handles }` to `/api/analyze` via the `analyze()` client fn (update its body type to the new shape and return `AnalysisResult`).

- [ ] **Step 1:** implement the setup additions + update `web/lib/client.ts` `analyze()` body/return types to the new shape (import `AnalysisResult`).
- [ ] **Step 2:** `npm run build` → passes (type-check catches mismatches). **Step 3:** commit `feat(web): setup — github username + goal selector with default exemplars`.

---

## Task 7: Results UI — positioning, domain map by stage, learning path

**Files:** Create `web/components/PositioningPanel.tsx`, `web/components/DomainMap.tsx`, `web/components/LearningPath.tsx`, `web/components/ProjectGaps.tsx`; modify `web/app/AnalyzerApp.tsx` results phase. Invoke the `frontend-design` skill to match the existing neutral/editorial aesthetic (no Anthropic/Claude branding; no "Claude"/LLM mention).

Render an `AnalysisResult`:
- **Goal banner**: "Path to: <goal label>", targetsAnalyzed, date, and the `summary` narrative.
- **PositioningPanel** (prominent, near top): `currentSignal` → `targetSignal`, the `gap`, and `moves[]` as an action list; show `evidence`.
- **DomainMap**: concepts grouped into four columns/bands by `stage` (fading | table-stakes | current-frontier | emerging), each concept chip marked by `youHave` (solid/partial/missing, visually distinct); this makes the trajectory legible.
- **LearningPath**: ordered cards (rank): concept name, `whyNow`, `whatToLearn`, verified `resources` as external links, and the `project`.
- **ProjectGaps**: list of `{theme, suggestion, seenIn}`.
- **Caveat footer**: the honest-scope note from spec §8.

- [ ] **Step 1:** build the components + wire into the results phase, rendering the new schema. Keep components small/focused.
- [ ] **Step 2:** `npm run build` → passes. **Step 3:** commit `feat(web): goal-directed results UI (positioning, domain map, learning path)`.

---

## Task 8: Local smoke + cleanup

- [ ] **Step 1:** Ensure `npx vitest run` (full suite) and `npm run build` both pass.
- [ ] **Step 2 — manual local smoke (documented, run by the human):** with `web/.env.local` set, `npm run dev`, upload a résumé, set GitHub username, pick "Founding Engineer", Analyze → confirm a concept map + learning path + positioning render. (Acceptance: non-empty concepts, a positioning read, ordered learning path.)
- [ ] **Step 3:** remove now-dead code from the old flat-gap path (old `Gap`/`Report` types, `ProgressFeed` if unused, `gaps.ts` only if no longer imported as evidence — keep if synthesis route still uses tool extraction). Commit `chore(web): remove dead flat-gap rendering path`.

---

## Self-Review

- §1 inputs (résumé, GitHub username, goal, targets) → Tasks 5, 6. ✅
- §2 evidence (own+target harvest, project title/description capture, merged baseline) → Tasks 2, 5. ✅
- §3 synthesis (graph concepts w/ stage+youHave+evidence+relationships, learning path ordered, projectGaps, positioning) → Tasks 1, 4. ✅
- §4 rendering (goal banner, positioning, domain map by stage, learning path, project gaps, caveat) → Task 7. ✅
- §5 reuse/replace → Tasks 2/5 reuse harvest; Task 8 removes dead path. ✅
- §6 stateless/local-first/web-dark → no DB; local smoke Task 8; web search not built (dark). ✅
- §7 testing → Vitest units (1,2,4), route integration (5), build gate (5,6,7), property-not-prose for LLM (4). ✅
- **Type consistency:** `AnalysisResult` (result-types.ts) ↔ `AnalysisResultSchema` (zod) identical fields; `ExtractedRepo` gains `description`/`topics` (Task 2) used by Task 5's `yourProjects`/`projects`; `synthesize(deps,input)` / `orderLearningPath(concepts,path)` / `runGoalAnalysis(deps,body)` signatures match their tests. `analyze()` client return = `AnalysisResult`. ✅
- **Placeholder scan:** complete code/tests for the testable core (1,2,4,5); UI tasks (6,7) specify components + render contract precisely and use the frontend-design skill for styling — acceptable since they're verified by the type-checking build + the documented local smoke. ✅

**Documented decision:** the synthesis LLM call uses `claude-sonnet-4-6` (capable reasoning for trajectory + positioning); cheap extraction (résumé, methodology tags) stays on `claude-haiku-4-5`. Model ids are config constants.
