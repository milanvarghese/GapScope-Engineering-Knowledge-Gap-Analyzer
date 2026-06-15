# GapScope v1 — Goal-Directed Gap Analysis

**Design spec** · 2026-06-13 · author: Milan Varghese

Replaces the package-diff analysis with **goal-directed, evidence-grounded LLM synthesis.** The
product answers three questions about reaching a chosen career goal: **what to learn**, **what to
build**, and **how to be read**. Stateless v1, runs locally first. Reuses the existing Next.js
app shell + harvest engine; replaces the analysis core + results UI.

## 0. Why this exists (the product in one line)

> Pick where you want to be (the goal) and who's already there (the targets); GapScope shows you
> the path — the skills, the projects, and the positioning that stand between you and that role.

Skills are not the end; they serve a **goal**. And the gap is not only knowledge — it's also
**direction/positioning** (a researcher-signalling profile rejected for a builder role is a real,
common failure a skills list can't catch).

## 1. Inputs (setup screen)

- **Résumé (PDF upload)** → extracted skills (Claude reads PDF natively).
- **Your GitHub username** → harvest *your* recent repos as baseline evidence.
- **Goal / persona** → preset (`founding-engineer`, `forward-deployed-engineer`,
  `faang-google`, `ai-research-engineer`) **+ free-text**. Drives the entire framing.
- **Targets** → default frontier engineers for the goal (editable), or custom handles
  (including friends). These are *exemplars of the goal* — the bar.

## 2. Evidence layer (reuse + extend the harvest engine)

Harvest **both your repos and the targets'** (bounded, concurrent, recency-first — existing
engine). For every repo collect, in addition to today's tool extraction:
- **tools** (manifests) and **methodology signal** (READMEs) — existing.
- **project title + description + topics** — **free from the repos listing** (the GitHub
  `/users/{u}/repos` response already includes `name`, `description`, `topics`; no extra calls).
  This is project-level signal: *what people build*, not just *what they import*.

Outputs of this layer:
- `baseline` = résumé skills ∪ tools extracted from your own repos (what you know + what you've
  shipped — the C-option from the original design).
- `yourProjects` = your repos' titles/descriptions.
- `targetEvidence` = per-target tools, methodology tags, and project titles/descriptions.

## 3. Synthesis (the new LLM core)

One structured reasoning call. **Model:** configurable; default a capable model
(`claude-sonnet-4-6`) for the synthesis — this step IS the product's intelligence; Haiku is too
weak for nuanced trajectory + positioning reasoning. Cheap extraction (résumé, methodology tags)
stays on Haiku. Inputs: `goal`, `baseline`, `yourProjects`, `targetEvidence`, `domain`.

Produces a **graph-shaped, goal-framed result** (validated by Zod):

- **`summary`** — narrative: where you stand relative to the goal, grounded in the evidence.
- **`concepts[]`** — the domain map as a small graph. Each: `id`, `name`,
  `stage` (`fading` | `table-stakes` | `current-frontier` | `emerging`),
  `youHave` (`solid` | `partial` | `missing`, positioned from your baseline),
  `importanceForGoal` (how much it matters for *this* goal),
  `evidence[]` (which targets/repos show it),
  `relationships[]` (`{type: "supersedes"|"prerequisite-of"|"related", target: conceptId}`).
- **`learningPath[]`** — the missing/partial concepts, **ordered** by stage priority ×
  prerequisite edges. Each: `conceptId`, `rank`, `whyNow` (its place in the trajectory toward
  the goal), `whatToLearn`, `resources[]` (`{title, url, verified}` — verified at build time,
  dead links dropped), `project` (a build idea, grounded in a real target repo when possible).
- **`projectGaps[]`** — project themes the targets built that your repos don't show
  (from title/description comparison) — concrete "build this" gaps.
- **`positioning`** — the direction read: `currentSignal` (e.g. "researcher-leaning") with
  `evidence`, `targetSignal` (what the goal role expects, e.g. "builder/shipper/owner"), `gap`,
  and `moves[]` (concrete repositioning actions grounded in your real work — e.g. "foreground
  your 0→1 shipping; it's currently overshadowed by research framing").

## 4. Output rendering (results UI — rework)

Replaces the flat gap table. Sections, top to bottom:
1. **Goal banner** — "Path to: <goal>", targets analyzed, date.
2. **Positioning read** — prominent: how your profile is *read* vs. what the role expects, with
   the concrete moves. (This is the differentiator; give it weight.)
3. **Domain map** — concepts grouped/colored by `stage` (fading → table-stakes → frontier →
   emerging), your `solid`/`partial`/`missing` status marked; the trajectory is visible at a
   glance. Reuse/extend the existing card components.
4. **Learning path** — ordered cards: each concept with *why now*, *what to learn*, verified
   *resources*, and a *project to build*.
5. **Honest caveats** — a short, visible note: this measures the *skills + signal* dimension of
   eligibility from public evidence; interviews, system-design rounds, and behavioral readiness
   are a separate axis. No fake readiness score.

## 5. Reuse vs. new vs. replaced

- **Reuse:** `github.ts` harvest, `manifests.ts`, `denoise.ts`, `methodology.ts`, `anthropic.ts`
  (extend), the `/api/resume` endpoint, the non-streaming JSON `/api/analyze` pattern, the app
  shell, and result card styling.
- **New:** `synthesis.ts` (the big structured LLM call + Zod schema), goal preset config,
  project-title capture in harvest, setup-screen additions (GitHub username, goal selector),
  reworked results components (positioning, domain-map-by-stage, learning-path).
- **Replaced:** the displayed package-gap list. `computeGaps` / methodology become *evidence
  inputs* to synthesis, not the output. The old `Gap`/`Report` types are superseded by the new
  result schema (keep old types only if still referenced; otherwise remove).

## 6. Constraints & ops

- **Stateless v1** (no DB). Accounts, saved history, the persisted knowledge graph, trend-over-
  time, and the social/graph "intersection" features are **v2** (see `VISION.md`).
- **Local-first:** runs via `npm run dev` with `web/.env.local` holding `ANTHROPIC_API_KEY` +
  `GITHUB_TOKEN`. Validate locally before any deploy.
- **Web search** (freshness top-up via Claude's web-search tool): designed-in as an opt-in
  toggle, **shipped dark in v1**.
- **Latency:** one synthesis call + bounded concurrent harvest. Non-streaming JSON response (the
  pattern we fixed). Synthesis on a capable model may take ~10–30s; acceptable with a spinner.
  Locally there's no function timeout; for later Vercel deploy, the single synthesis call + bounded
  harvest should fit, with Pro as the fallback for the time cap.

## 7. Testing

- **Engine units** (harvest incl. project-title capture, denoise, manifests) — Vitest, mock fetch.
- **`synthesis.ts`** — injected LLM stub returning a canned graph; assert the code orders the
  learning path correctly (stage × prerequisite), filters baseline concepts, and shapes the
  result; **never assert exact LLM prose** (structure + properties only).
- **`/api/analyze`** — integration test with stubbed harvest + synthesis deps asserting the
  result shape (concepts, learningPath ordering, positioning present).
- **Resource link verification** reused from existing `links` logic.
- `npm run build` passes (type-check gate). Existing Python suite untouched (reference engine).

## 8. Honest scope boundary

v1 produces a *grounded interpretation* — skills gap, project gaps, and positioning signal —
toward a goal, validated against people already in that role. It is **not** a hiring verdict or
readiness score; interview/behavioral/system-design readiness is explicitly out of scope and
labeled as such in the UI.
