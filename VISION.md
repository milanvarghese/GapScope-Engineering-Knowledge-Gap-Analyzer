# GapScope — Vision & Roadmap

**One line:** Pick where you want to be (a goal) and who's already there (targets); GapScope shows
you the path — the skills to learn, the projects to build, and the positioning to fix — between
you and that role.

Skills are not the end. They serve a **goal**. And the gap is rarely only knowledge — it's also
*direction*: a profile that signals "researcher" gets rejected for a "builder" role even when the
skills are there. GapScope measures all of it, grounded in evidence from people already in the role.

---

## v1 — Goal-directed analysis (current build, local-first)

Stateless web app. Inputs: résumé + your GitHub + a goal + target engineers. Output, all framed
toward the goal:
- **What to learn** — a trajectory-aware concept map (fading → table-stakes → frontier → emerging)
  with your position on it, and a sequenced learning path (why-now, what-to-learn, resources,
  project).
- **What to build** — project gaps vs. what the frontier ships.
- **How to be read** — a positioning/direction read (how your profile signals vs. what the role
  expects) with concrete repositioning moves.

Spec: `docs/superpowers/specs/2026-06-13-gapscope-goal-directed-analysis-design.md`.

## v2 — Persistence + knowledge graph

Add accounts (Supabase) + saved analyses. This unlocks:
- A **persisted knowledge graph** accumulating concepts across runs and people.
- **Trend over time** — watch the frontier move, and watch your gap shrink as you learn (real
  data, not a single snapshot).
- Shareable result links (needs storage).

## v3 — The social / discovery layer ("the awe")

Built on the v2 graph:
- **Network analysis** — point it at friends; see what they're building and their stacks.
- **Graph intersections** — who's working on similar problems; where your frontier overlaps with
  your network's; what new projects friends just started.
- Discovery of collaborators and adjacent opportunities.

## Later / parked

- **New problem-solving-technique discovery** (beyond known concepts).
- **Live web-search freshness** (designed into v1 as an opt-in toggle, shipped dark; promote when
  the core proves out).
- Non-technical eligibility (interview/system-design/behavioral readiness) — explicitly out of the
  current scope; v1 is honest that it measures the skills + signal dimension only.
