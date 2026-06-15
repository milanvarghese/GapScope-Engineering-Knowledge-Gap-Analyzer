# GapScope — Engineering Knowledge-Gap Analyzer

**Pick where you want to be and who's already there — GapScope shows you the path.**

GapScope is a goal-directed career-gap analyzer. You give it your résumé, your GitHub, a
goal (e.g. *founding engineer*), and a few engineers who already embody that goal. It mines
real evidence from their public repos, grounds it with an LLM that knows the field's
trajectory, and tells you three things:

- **What to learn** — a trajectory-aware concept map (fading → table-stakes → current-frontier →
  emerging) with your position on it, and a sequenced learning path (why now, what to learn,
  verified resources, a project to build).
- **What to build** — concrete project gaps versus what the frontier actually ships.
- **How to be read** — a *positioning* read: how your profile signals (e.g. researcher) versus
  what the role expects (e.g. builder/shipper), with concrete moves to shift it.

It also produces a **per-profile comparison** — you versus each engineer you provide.

> Skills aren't the end; they serve a goal. And the gap is often not knowledge but *direction* —
> a researcher-signalling profile gets passed over for a builder role even when the skills are
> there. GapScope measures all of it, grounded in people already in the role.

## How it works

```
résumé (PDF)  ─┐
your GitHub   ─┤→ evidence harvest (your repos + targets' repos:
goal          ─┤   tools from manifests, project titles/descriptions,         ┌─ concept map (trajectory + your position)
target repos  ─┘   methodology signal)  ─→  LLM synthesis (grounded) ─────────┤─ sequenced learning path
                                                                              ├─ project gaps
                                                                              ├─ positioning read
                                                                              └─ per-profile comparisons
```

The harvest is deterministic and bounded (recency-first, fork/archived/lockfile-dump filtered).
The synthesis is one structured LLM pass that returns a validated graph-shaped result; resource
links are HTTP-verified before display (no fabricated links).

## Tech stack

- **App:** Next.js (App Router, TypeScript), Tailwind — `web/`
- **LLM:** Anthropic Claude (`claude-sonnet-4-6` for synthesis, `claude-haiku-4-5` for cheap
  extraction); résumé PDFs read natively
- **APIs:** GitHub REST (repo evidence)
- **Tests:** Vitest

## Run locally

```bash
cd web
npm install
# create web/.env.local with your keys (git-ignored):
#   ANTHROPIC_API_KEY=sk-ant-...
#   GITHUB_TOKEN=github_pat_...      # public-repo read; raises the crawl rate limit
npm run dev          # http://localhost:3000
```

Then: upload résumé → enter your GitHub (username or profile URL) → pick a goal → add target
profiles (frontier engineers and/or friends) → **Analyze**.

`GITHUB_TOKEN` (fine-grained, *Public Repositories — read-only*) is required for the crawl;
`ANTHROPIC_API_KEY` powers the résumé read + synthesis.

## Deploy

The app deploys to Vercel as-is (root directory `web/`). Set `ANTHROPIC_API_KEY` and
`GITHUB_TOKEN` as project environment variables. See `DEPLOY.md`. Note: a full synthesis run is
a single heavy LLM call — on Vercel's free tier (60s function cap) keep target counts modest, or
use Vercel Pro for longer runs.

## Roadmap

`VISION.md` has the full picture. In brief:

- **v1 (now):** goal-directed analysis — what to learn / build / how to be read (stateless).
- **v2:** accounts + saved history + a persisted knowledge graph → *gap-over-time* trends.
- **v3:** the social/discovery layer — analyze your network, find who's working on similar
  problems, graph intersections.

## Repository layout

- `web/` — the Next.js app (the product). Engine logic in `web/lib/engine/`, API routes in
  `web/app/api/`.
- `src/gapscope/` — the original Python batch engine (a CLI / reference implementation that the
  TypeScript engine was ported from; not part of the deployed app).
- `docs/superpowers/specs/` & `docs/superpowers/plans/` — design specs and implementation plans.

## Status

v1 is built and runs locally. It measures the **skills + signal** dimension of eligibility from
public evidence — interview, system-design, and behavioral readiness are a separate axis and out
of scope.
