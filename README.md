# GapScope — Engineering Knowledge-Gap Analyzer

Finds the delta between what you know and what accomplished engineers actually use.
Plan 1 (this stage) is the deterministic engine: it mines target GitHub users' recent
repos, extracts their tools, subtracts your baseline, and writes a ranked `data.json`.
No LLM/API cost.

## Setup

```powershell
py -3.11 -m venv .venv      # any Python 3.11+ works, e.g. py -3.14
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
copy .env.example .env       # then add a GITHUB_TOKEN (optional, raises rate limit)
```

## Configure

Edit `config/targets.yaml` — set `you:` to your username and add real target usernames
per role. Edit `config/baseline_seed.yaml` with tools/methods you already know.

## Run

```powershell
$env:GITHUB_TOKEN = "ghp_xxx"   # optional
.\.venv\Scripts\gapscope.exe sweep --role ai-engineer --out data.json
```

Output: `data.json` — ranked gaps (tools the targets use that you don't), newest/most
common first. The schema is documented in `docs/superpowers/specs/2026-06-13-gapscope-design.md` (§8).

## Test

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```
