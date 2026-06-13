# GapScope Plan 2 — Denoise + LLM Enrichment

**Design spec** · 2026-06-13 · author: Milan Varghese
**Status:** decisions made autonomously (user delegated completion). Review when back.

Builds on Plan 1 (deterministic engine, merged). Parent spec:
`docs/superpowers/specs/2026-06-13-gapscope-design.md` (§5 stages 5/5.5/8, §6, §7).

---

## 0. Why this plan changed shape

The live Plan-1 sweep (5 AI-engineer targets) exposed that raw tool-counting is noisy:
30 `@radix-ui/*` packages + `clsx`/`cmdk`/`vaul` are *one* learnable thing (shadcn/ui), and
`@types/*` / `postcss` / `eslint` aren't skills at all. ~47 of 287 gaps were scaffold noise.

So Plan 2 has two components, in order:

1. **Denoise (deterministic, free, always-on)** — collapse noise into concepts. Fixes signal
   quality for *everyone*, including the free path.
2. **LLM enrichment (opt-in, `--enrich`, needs `ANTHROPIC_API_KEY`)** — methodology inference,
   research of unknowns, and study recommendations. You only pay when you ask for it.

---

## 1. Component A — Denoise (free, always runs)

Applied inside gap computation, after extraction, before ranking.

- **Denylist** (`config/tool_denylist.yaml`) — packages that are not learnable skills: type
  stubs (`@types/*` by prefix), build/lint tooling (`postcss`, `autoprefixer`, `eslint`,
  `eslint-config-*`, `prettier`, `ts-node`, `tsx`). Matched by exact name or `*` suffix prefix.
- **Grouping map** (`config/tool_groups.yaml`) — fold known dependency families into one concept:
  - `@radix-ui/*`, `class-variance-authority`, `clsx`, `tailwind-merge`, `cmdk`, `vaul`,
    `sonner`, `lucide-react`, `tailwindcss-animate` → **`shadcn/ui`**
  - members are replaced by the group id; frequency/recency aggregate onto the group.
- Frameworks (`react`, `next`, `tailwindcss`, `typescript`, `fastapi`, `torch`, …) are NOT
  grouped — they are themselves the learnable unit.
- Denylist/group maps are versioned config, editable, and conservative. Everything not listed
  passes through unchanged (open-ended principle preserved).

Denoise is pure and unit-tested with no I/O.

---

## 2. Component B — LLM enrichment (opt-in)

Gated behind `gapscope sweep --enrich`. If the flag is set but `ANTHROPIC_API_KEY` is missing,
the run errors clearly (does not silently skip). Three sub-stages:

### 2.1 Methodology inference (during harvest)
For each target, take up to **3** most-recent kept repos; fetch each README; one **Haiku** call
per README returns an open-ended list of methodology tags + one-line descriptions ("uses an
MCP server", "RAG over a vector store", "agent + tool-calling loop") — NOT classification against
a checklist. Tags are normalized (lowercased, trimmed) and **clustered by exact normalized
match** across all targets into `kind:"methodology"` gap items, with the same frequency/recency
treatment as tools. Cross-target frequency = number of distinct targets whose repos surfaced the
tag.

### 2.2 Resolver — research unknowns (after ranking)
For the **top-N** ranked gaps (default **15**, `--research-top` configurable) that lack a known
doc, research from live sources:
1. PyPI / npm registry metadata (deterministic, factual).
2. context7 MCP (`resolve-library-id` → `query-docs`) for current official docs.
3. One Haiku synthesis → a short `research.summary`.
The long tail gets the cheap registry one-liner only (`research.researched=false`).

### 2.3 Recommender (after research)
For the same top-N gaps:
- **Docs** (`docs[]`, every link `verified`): curated registry (`config/docs_registry.yaml`)
  first → context7 link → fallback to PyPI/npm/GitHub URL. Every URL HTTP-checked at build time;
  dead links dropped. No fabricated link ships.
- **Projects** (`projects.small[]` / `projects.big[]`): one Haiku call per gap → 1-2 small +
  1 big project idea grounded in the research summary.

---

## 3. LLM client + caching

- `llm.py` — thin wrapper over the Anthropic SDK. Model id from config
  (`config/llm.yaml`, default `claude-haiku-4-5`). Constructor accepts an injected client for
  tests (mirrors `GitHubClient(http=...)`). **Consult the `claude-api` skill before implementing**
  for the correct model id, SDK call shape, and message format.
- **Cache** (`cache.py`) — every LLM call keyed by SHA-256 of (model + prompt). Hits served from a
  local dir `.gapscope_cache/` (gitignored). Makes reruns near-free and tests hermetic (a
  pre-seeded cache → no network). Unchanged repos are never re-paid.
- Cost guardrails: Haiku everywhere, top-N research, SHA-keyed cache, ≤3 READMEs/target.

---

## 4. Data contract (unchanged shape, now fully populated)

`data.json` gains nothing structurally — Plan 1 already emitted the full schema with empty
`docs`/`projects`/`research` and `kind:"tool"` only. Plan 2 fills them and adds
`kind:"methodology"` items. Existing consumers keep working.

---

## 5. CLI surface

- `gapscope sweep --role X` — unchanged free path, now with denoise applied.
- `gapscope sweep --role X --enrich` — adds methodology inference + research + recommendations
  (requires `ANTHROPIC_API_KEY`; `--research-top N` optional, default 15).

---

## 6. New / changed files

```
config/tool_denylist.yaml      (new)
config/tool_groups.yaml        (new)
config/docs_registry.yaml      (new)
config/llm.yaml                (new — model name)
src/gapscope/denoise.py        (new — denylist + grouping, pure)
src/gapscope/llm.py            (new — Anthropic wrapper, injectable)
src/gapscope/cache.py          (new — SHA-keyed disk cache)
src/gapscope/methodology.py    (new — README → tags via LLM, cluster)
src/gapscope/resolver.py       (new — PyPI/npm + context7 + synthesis)
src/gapscope/recommender.py    (new — docs verify + project ideas)
src/gapscope/links.py          (new — HTTP link verification)
src/gapscope/gaps.py           (modified — apply denoise before ranking)
src/gapscope/cli.py            (modified — --enrich / --research-top wiring)
+ tests for each
```

Each file: one responsibility, injectable I/O, unit-tested with fakes. No live API in tests.

---

## 7. Testing strategy

- Denoise, grouping, link-verification logic: pure / MockTransport, fully deterministic.
- LLM-touching stages: a `FakeLLMClient` returning canned JSON + `FakeGitHub` for READMEs +
  pre-seeded cache. Assert structure & properties (per AURIA-style discipline), never exact LLM prose.
- A live `--enrich` smoke is deferred until the user supplies `ANTHROPIC_API_KEY`.

---

## 8. Out of scope (later plans)

- Frontend (Plan 3), deployment (Plan 4).
- Embedding-based methodology clustering (v1 uses exact normalized match; revisit if synonyms
  fragment the list).
- Résumé auto-parse into baseline (still represented by editable seed).
