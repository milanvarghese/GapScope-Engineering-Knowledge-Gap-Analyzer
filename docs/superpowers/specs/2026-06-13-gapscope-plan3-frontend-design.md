# GapScope Plan 3 — Frontend (Next.js / Vercel)

**Design spec** · 2026-06-13 · decisions made autonomously (user delegated). Review when back.

A Next.js (App Router, TypeScript, Tailwind) dashboard that renders the `data.json` the
engine produces. Lives in `web/`. Hosted on Vercel.

## Hard constraints
- **Custom, neutral visual identity. No Anthropic/Claude colors, branding, or styling. The UI
  must not mention Claude or any LLM** — the model is an implementation detail.
- Must build cleanly: `npm run build` passes (type-check + compile) — this is the gate.

## Data source
- Reads `web/public/data.json` (client `fetch('/data.json')`). A representative sample is
  committed so the site renders out of the box. Plan 4's GitHub Action overwrites this file
  with fresh sweep output on each run.
- Schema = the engine's `data.json` (spec §8): `meta {generatedAt, role, targetsAnalyzed}`,
  `baseline {tools[], methods[]}`, `gaps[] {id, name, kind, frequency, recencyScore,
  rankScore, evidence[{repo,signal}], research{summary,researched}, docs[{title,url,verified}],
  projects{small[],big[]}}`. `research`/`docs`/`projects` may be empty (free sweep).

## Views (single dashboard page)
1. **Header** — product name "GapScope", the analyzed `role`, `targetsAnalyzed`, generated date.
2. **Ranked gap list** — sorted by `rankScore` desc. Each row: name, a `kind` badge
   (tool vs methodology), frequency, a rankScore bar. Expand → research summary (if present),
   evidence repos, verified doc links (only `verified:true`), small/big project ideas.
3. **Controls** — filter by kind (all / tools / methodologies), free-text search over name.
4. **Baseline panel** — collapsible; lists what GapScope thinks you already know.

## Structure
```
web/
  package.json, tsconfig.json, next.config.*, tailwind/postcss config
  app/layout.tsx, app/page.tsx, app/globals.css
  components/  (GapList, GapRow, Controls, BaselinePanel, etc.)
  lib/types.ts  (TypeScript types mirroring the schema)
  public/data.json  (sample)
```

## Out of scope (Plan 4 / later)
- The on-demand "analyze a new profile live" serverless function (the reason we chose Next.js
  over static) — scaffold-ready, not built here.
- Deployment wiring (Vercel project + Actions) — Plan 4.
