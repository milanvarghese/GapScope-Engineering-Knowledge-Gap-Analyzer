# GapScope — Interactive Résumé-Driven App

**Design spec** · 2026-06-13 · author: Milan Varghese

Supersedes the batch/static model for the *product surface*. Replaces the static dashboard with
an interactive web app: **upload résumé → pick/enter engineers → Analyze → live-streamed gap
results.** The Python batch engine (`src/gapscope/`) stays in the repo as a reference / CLI; the
deployed product is this Next.js app. The existing dashboard components (`web/components/`) are
reused to render results.

## 1. Goal & user flow

A single Next.js app on Vercel. **Stateless v1** — nothing persisted between visits (accounts +
saved history + gap-over-time are a future Supabase-backed v2, explicitly out of scope here).

1. **Setup screen**
   - **Upload résumé (PDF).** Sent to Claude as a PDF document block → Claude extracts known
     tools/skills → baseline. User sees the extracted skills as editable chips and can remove
     wrong ones before analyzing. (Claude reads PDFs natively — no PDF-parsing library.)
   - **Choose targets.** Pick a **role** (loads a built-in default set of well-known engineers)
     and/or type custom GitHub handles. Editable chips.
   - **Analyze** button.
2. **Live progress** — SSE stream: "reading résumé… harvesting alice (5 repos)… inferring
   methodologies… ranking…". This is the 30–90s window.
3. **Results** — ranked gap list in the existing `GapList`/`GapRow` components. Expanding a gap
   lazily fetches its "what to study" (docs + project ideas).

## 2. Architecture

One Next.js app (App Router, TS) on Vercel. Engine logic ported to TypeScript inside Route
Handlers. Secrets are **server-side Vercel env vars**, never shipped to the browser:
`ANTHROPIC_API_KEY` (résumé parse + methodology + study) and `GITHUB_TOKEN` (raises crawl rate
limit 60→5000/hr — required).

### Endpoints
- **`POST /api/resume`** — multipart PDF upload → Claude (PDF document block, structured output)
  → `{ tools: string[] }`. Lets the user preview/edit baseline before analyzing.
- **`POST /api/analyze`** — body: `{ baseline: {tools[]}, handles: string[], role }`. Returns an
  **SSE stream**: a sequence of `progress` events, then a final `result` event with the `Report`.
  Bounded (see §4). This is the heavy path.
- **`GET /api/study?tool=<id>`** — lazy, on gap-expand: PyPI metadata + Claude → `{summary}`,
  verified doc links, `{small[],big[]}` project ideas. Keeps `/api/analyze` lean.

### TS engine modules (`web/lib/engine/`, mirror the tested Python logic)
- `github.ts` — `listRepos(user)`, `getFile(owner,repo,path)` via `fetch` + token.
- `manifests.ts` — parse `requirements.txt` / `pyproject.toml` / `package.json`; `normalize`;
  `isDependencyDump` (skip pip-freeze/Colab dumps).
- `denoise.ts` — denylist + grouping (data from `web/lib/engine/denoise-data.ts`).
- `gaps.ts` — difference vs baseline, `rankScore = 0.7·normFreq + 0.3·normRecency`, evidence cap.
- `methodology.ts` — README → tags via Claude (`@anthropic-ai/sdk`, structured output), cluster.
- `anthropic.ts` — thin Claude wrapper (`messages` / structured output), model `claude-haiku-4-5`.
- `config.ts` — `DEFAULT_PEOPLE` per role (editable), `DOCS_REGISTRY`, bounding constants.

### Frontend (`web/`)
- `app/page.tsx` → setup screen (`ResumeUpload`, `TargetPicker`, `AnalyzeButton`).
- `app/components/ProgressFeed.tsx` — consumes the SSE stream.
- Reuse `GapList`/`GapRow`/`Controls`/`BaselinePanel` for results.
- `lib/types.ts` — existing `Report`/`Gap` types stay the contract (engine output unchanged shape).

## 3. Data shapes
`Report`/`Gap`/`Evidence`/`Doc` are exactly the existing `web/lib/types.ts` (the dashboard
already renders them). `/api/resume` returns `{ tools: string[] }`. `/api/study` returns
`{ summary: string; docs: Doc[]; projects: { small: string[]; big: string[] } }` which the
client merges into the expanded gap.

## 4. The hard constraint — fit Vercel Hobby (≤60s) by bounding

Vercel's free tier caps a function at **60s**. The chosen 30–90s UX is achieved by bounding the
live run to fit ~60s, with all I/O concurrent:
- `MAX_PEOPLE = 6`, `MAX_REPOS_PER_PERSON = 5` (recency-first, skip forks/archived/dumps).
- Methodology inference on `MAX_READMES = 8` total (Haiku, concurrent).
- Per-person harvest + per-README inference run with bounded concurrency (e.g. 5 at a time).
- The default "famous engineers" sets are sized to fit this budget.
- Deeper one-shot runs (more people / every repo) = a later **Vercel Pro** toggle
  (`maxDuration` up to 300s), not a rebuild. `export const maxDuration = 60` on the route.

`/api/study` is a single tool's research — fast, well under the cap, called per gap-expand.

## 5. Error handling
- Missing `ANTHROPIC_API_KEY` / `GITHUB_TOKEN` → the endpoint returns a clear error the UI shows
  ("server not configured"). Never silently degrade.
- A target handle that 404s or yields no repos → emitted as a `progress` warning, skipped; the
  run continues (one bad handle never aborts analysis).
- Résumé parse failure (unreadable PDF) → `/api/resume` returns an error; user can retry or hand-
  add skills.
- GitHub rate-limit / network errors per repo → skip that repo, note it, continue.

## 6. Testing
- **Pure engine units** (`manifests.ts`, `denoise.ts`, `gaps.ts`) with **Vitest** — mirror the
  Python tests (same cases: normalization, dump detection, denylist/grouping, freq×recency rank,
  baseline subtraction). Deterministic, no network.
- **`github.ts` / `anthropic.ts`** — tested with injected `fetch` / client stubs.
- **`methodology.ts`** — injected Claude stub returning canned tags.
- API routes: a thin integration test of `/api/analyze` happy path with stubbed engine deps
  (stream emits progress then a result with expected gap ids).
- `npm run build` must pass (type-check) — a CI gate.
- The existing Python test suite stays green (reference engine untouched).

## 7. Out of scope (future)
- **Supabase v2**: accounts, saved résumé baseline, analysis history, gap-over-time trend chart.
- Persistent caching of study/methodology results (Vercel KV or Supabase) — v1 re-computes.
- The on-demand "analyze a single arbitrary profile" beyond the bounded set.
- The GitHub Actions batch sweep stays as a CLI/reference path but the site no longer depends on
  it.

## 8. What changes in the repo
- **Added:** `web/lib/engine/*`, `web/app/api/{resume,analyze,study}/route.ts`, setup-screen +
  progress components, Vitest config + engine tests.
- **Changed:** `web/app/page.tsx` (static viewer → interactive setup+results); `web/package.json`
  (+`@anthropic-ai/sdk`, +`vitest`).
- **Kept:** Python engine + its tests (reference/CLI); dashboard render components; `Report`
  types. **Removed from the deployed path:** reliance on a committed `web/public/data.json`
  (now produced live; a small sample may remain for empty-state/dev).
