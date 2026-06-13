# GapScope — Engineering Knowledge-Gap Analyzer

**Design spec** · 2026-06-13 · author: Milan Varghese

---

## 1. Purpose

GapScope finds the **delta between what you know and what accomplished startup-ecosystem
engineers actually use**. It mines those engineers' public GitHub repositories, extracts the
tools and methodologies they reach for, subtracts what you already know, ranks what's left by
how common and how recent it is, and for each gap tells you **what to read** (official docs /
tutorials) and **what to build** (small + big project ideas) to close it.

The point is **unknown-unknowns**: surfacing tools and patterns you didn't know you were
missing — not tracking a fixed list of technologies.

### Non-goals (v1)

- **No trend / historical view.** Explicitly deferred. v1 is a point-in-time ranked gap list.
- No multi-user accounts. This is a personal tool for one baseline (you).
- No live arbitrary-user analysis at launch (the architecture leaves room for it later).

---

## 2. Core principle — detect by *difference*, not by recognition

GapScope **never works from a fixed catalog of "known" technologies.** A catalog could only
ever surface gaps it was pre-told about, which defeats discovery. Detection is **open-ended
extraction**:

```
gap = { everything extracted from targets } − { everything in your baseline }
```

The system's own prior knowledge never enters that equation. A library that neither you nor
the system has heard of still surfaces, because it appears in the targets' repos and not in
yours. Once an unknown surfaces, the system **researches it from authoritative live sources**
(PyPI/npm, GitHub, context7 docs) rather than guessing from model memory. See §5 and §6.

---

## 3. Baseline — "what Milan knows"

Built from **two sources, merged** (the "C" decision):

1. **Résumé / written profile** — captures breadth, including things known but never pushed to
   GitHub.
2. **Your own GitHub repos** (`milanvarghese`) — ground-truth tools/methods you've actually
   shipped.

Output: a normalized set `{ tools[], methods[] }`. The baseline is **editable** — the frontend
shows what GapScope thinks you know so you can correct false positives/negatives before they
skew the gap.

---

## 4. Targets — whose repos to analyze

Input is either:

- a **manual list** of GitHub usernames, or
- a **curated default set keyed by role** (`ai-engineer`, `devops`, `security`, …) — vetted
  lists shipped with the repo.

Config lives in a versioned repo file: `config/targets.yaml`. Editing it + re-running the
sweep is how you change who's analyzed.

**Defaults (tunable in config):** ~10–20 targets per role; top **10** repos per target.

**Repo selection — recency-first.** Repos are ranked by **most recently pushed**, because the
goal is discovering what these devs use *now* — stars bias toward old, famous repos with stale
stacks. To cut noise, repos are filtered *before* ranking:

- exclude **forks** and **archived** repos,
- exclude repos with **no dependency manifest** (no `requirements.txt` / `package.json` /
  `pyproject.toml` / … → no extractable tool signal).

Stars are a **tiebreaker only** (optional), never the primary sort.

---

## 5. Architecture — hybrid pipeline (Approach 3)

A batch pipeline. Deterministic code does the structural work; the LLM is isolated to two
stages (a bounded agent + a scripted call) plus the resolver. Stages in order:

**Deterministic (code, no LLM, free):**

1. **Baseline builder** — parse résumé + harvest your repos → `{ tools, methods }` (§3).
2. **Target collector** — manual list or role default → list of usernames (§4).
3. **Repo harvester** — per target, fetch top-N repos; pull manifests
   (`package.json`, `requirements.txt`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Gemfile`,
   …), CI workflow YAMLs, repo topics, languages, and READMEs. GitHub API only.
4. **Tool extractor — open-ended.** Capture *every* dependency string, recognized or not. A
   never-before-seen library is just an unrecognized entry — exactly the signal we want.
   Deterministic and unit-testable.

**Bounded agent (Claude, capped — the "hybrid" part):**

5. **Methodology inferrer** — a bounded Claude agent (hard cap on tool-calls/iterations per
   repo; Haiku; cached by repo commit-SHA) reads READMEs + a few signal files and describes,
   **open-endedly**, the architecture and notable patterns — *not* classification against a
   checklist. It may describe a novel pattern it cannot name. A cross-repo **clustering** step
   then groups similar descriptions into named gap items.

**Deterministic + resolver:**

5.5. **Resolver / research (§6)** — for each unknown gap item, investigate from live sources.
6. **Gap computer** — `(targets' tools+methods) − (baseline)` → gap items, each tagged with
   `frequency` (how many targets use it) and `recency` (from latest commit touching it).
7. **Ranker** — `rankScore = normalize(frequency) × normalize(recency)`; baseline items
   filtered out *before* ranking; ties broken by frequency.
8. **Recommender** — scripted Claude call per top-ranked gap → official docs/tutorial links
   (verified, §7) + small & big project ideas.
9. **Output writer** — emit `data.json` (§8).

**Key property:** stages 1–4, 6, 7, 9 are plain testable code. The LLM touches only 5, 5.5,
and 8. That is what keeps cost and debuggability sane.

---

## 6. Resolver — researching unknowns

When an unknown gap item surfaces, GapScope investigates rather than guessing:

1. **Identify** — PyPI/npm metadata + the tool's GitHub repo (description, stars, README
   excerpt). Deterministic, factual.
2. **Read the docs** — context7 MCP: `resolve-library-id` → `query-docs` for *current* official
   documentation. Web search only as a fallback when context7 returns nothing.
3. **Synthesize** — Claude turns that real material into a short card: what it is, the problem
   it solves, why these devs use it, verified docs link, small/big project ideas.

**Guardrails:**

- **Only top-ranked gaps get full research** (default: top **15**, tunable). The long tail gets
  the cheap PyPI/GitHub one-liner; full research runs only on items that matter.
- **Cached per item** — a researched card is reused on the next sweep unless its evidence
  changed.

---

## 7. Correctness risk — no hallucinated links

LLMs invent plausible-but-dead URLs; a 404 "official tutorial" is worse than useless.
Three-layer defense, every link verified before it ships:

1. **Curated registry first** — a small hand-maintained `tool → official docs domain` map for
   common cases (FastAPI, LangChain, Docker, …). Deterministic, always correct.
2. **Validate LLM links** — any URL Claude suggests gets an HTTP check at build time;
   dead/redirect-to-spam links are dropped, not published. Reflected by `"verified": true`.
3. **Guaranteed fallback** — if no verified official doc exists, link to the tool's GitHub repo
   or PyPI/npm page (deterministically real). A fabricated link never ships.

context7 (§6.2) reinforces this: its links are real by construction.

---

## 8. Data contract — `data.json`

The pipeline emits one JSON file; the frontend renders it.

```jsonc
{
  "meta":     { "generatedAt": "2026-06-13T...", "role": "ai-engineer", "targetsAnalyzed": 14 },
  "baseline": { "tools": ["fastapi","pytorch"], "methods": ["transfer-learning"] },
  "gaps": [
    {
      "id": "mcp",
      "name": "Model Context Protocol (MCP)",
      "kind": "methodology",                 // "tool" | "methodology"
      "frequency": 9,                          // how many target devs use it
      "recencyScore": 0.92,                    // 0–1, from latest commit touching it
      "rankScore": 0.88,                       // normalize(frequency) × normalize(recency)
      "evidence": [
        { "repo": "user/agent-x", "signal": "mcp server in pyproject + README" }
      ],
      "research": {
        "summary": "What MCP is and the problem it solves...",
        "researched": true                     // false = long-tail one-liner only
      },
      "docs":     [ { "title": "MCP Spec", "url": "https://modelcontextprotocol.io", "verified": true } ],
      "projects": {
        "small": ["Wrap a weather API as an MCP server"],
        "big":   ["Build an MCP server exposing your own tool, consumed by an agent"]
      }
    }
  ]
}
```

---

## 9. Frontend (Next.js / React on Vercel)

**Custom, neutral visual identity — no Anthropic/Claude colors, styling, or branding anywhere;
the UI does not mention Claude (the LLM is an implementation detail).**

- Single dashboard loads `data.json` and renders the **ranked gap list**. Each row: name, kind,
  frequency, rankScore; expands into the research card (what it is, evidence repos, verified
  docs, small/big projects).
- Controls: **role selector**, filter by `kind` (tools vs. methodologies), search box.
- **Baseline panel** — shows what GapScope thinks you know, so you can correct it.

Next.js (vs. plain static) is chosen to grow into the future on-demand "analyze a new profile
live" Vercel serverless feature without a rewrite.

---

## 10. Deployment & cost

- **Compute: GitHub Actions** runs the sweep (manual trigger + optional weekly cron). Claude
  API key + GitHub token are encrypted **Actions secrets**. It commits the refreshed
  `data.json`. No serverless timeout pressure for the long batch job.
- **Hosting: Vercel (Hobby, free)** auto-deploys the Next.js frontend on push; reads the
  committed `data.json`. Key never reaches the browser.
- **Config**: `config/targets.yaml` (targets/roles), curated docs registry, and tunables
  (top-N repos, research threshold) are versioned in the repo.

**Cost:** GitHub Actions (free, public repo) + Vercel Hobby (free). Only the Claude API is
pay-per-use — controlled via Haiku for both LLM stages, SHA-keyed caching of unchanged repos,
and research limited to top-ranked gaps. A full sweep should cost cents.

---

## 11. v1 scope summary

| Included | Deferred |
|---|---|
| Ranked gap list (tools + methodologies) | Trend / historical view |
| Open-ended extraction + difference-based detection | Live on-demand arbitrary-profile analysis |
| Resolver research of unknowns (top-N) | Multi-user accounts |
| Verified docs + small/big project ideas per gap | |
| Editable baseline (résumé + your repos) | |
| Manual + role-default targets | |
| Next.js frontend on Vercel | |
| GitHub Actions sweep | |
