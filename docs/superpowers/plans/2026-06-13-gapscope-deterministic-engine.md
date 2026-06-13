# GapScope — Deterministic Gap Engine (Plan 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Python CLI that harvests target GitHub users' recent repos, extracts their tools from dependency manifests, subtracts the user's baseline, and emits a ranked `data.json` of skill gaps — with **zero LLM/API cost**.

**Architecture:** A deterministic pipeline (no LLM). Stages: load config → harvest repos via GitHub API (recency-first, manifest-filtered) → parse manifests into tool sets → build baseline (own repos + seed) → compute gaps by difference → rank by `frequency × recency` → write `data.json`. The LLM stages (methodologies, research, recommendations) are a separate Plan 2 that enriches this same `data.json`.

**Tech Stack:** Python 3.11+, `httpx` (GitHub REST API), `pydantic` v2 (data contract), `PyYAML` (config), `tomllib` (stdlib, pyproject parsing), `pytest`.

**Spec:** `docs/superpowers/specs/2026-06-13-gapscope-design.md` (§3 baseline, §4 targets/recency, §5 stages 1–4/6/7/9, §8 data.json).

---

## File Structure

```
GapScope-Engineering-Knowledge-Gap-Analyzer/
├── pyproject.toml                 # package + deps + pytest + console script
├── .gitignore
├── .env.example                   # GITHUB_TOKEN
├── config/
│   ├── targets.yaml               # you: <user>; roles: {role: [usernames]}
│   └── baseline_seed.yaml         # manually-seeded known tools/methods (from résumé)
├── src/gapscope/
│   ├── __init__.py
│   ├── models.py                  # pydantic: Evidence, GapItem, Baseline, Meta, GapReport
│   ├── manifests.py               # manifest parsers + normalize_package_name + dispatch
│   ├── config.py                  # load_targets / load_seed
│   ├── github_client.py           # GitHubClient: list_repos, get_file
│   ├── harvester.py               # ExtractedRepo + harvest_user (recency-first, filtered)
│   ├── baseline.py                # build_baseline (own repos ∪ seed)
│   ├── gaps.py                    # compute_gaps (difference + rank)
│   ├── report.py                  # build_report / write_report
│   └── cli.py                     # argparse `gapscope sweep`, run_sweep
└── tests/
    ├── test_manifests.py
    ├── test_github_client.py
    ├── test_harvester.py
    ├── test_baseline.py
    ├── test_gaps.py
    ├── test_report.py
    └── test_cli_integration.py
```

**Responsibilities (one per file):** `manifests` = text→tool-names; `github_client` = HTTP only; `harvester` = repo selection + manifest fetch; `baseline`/`gaps` = pure set math; `report` = serialization; `cli` = wiring. Pure-logic files (`manifests`, `baseline`, `gaps`) have no I/O and are trivially testable.

---

## Task 1: Project scaffold

**Files:**
- Create: `pyproject.toml`, `.gitignore`, `.env.example`, `src/gapscope/__init__.py`, `tests/__init__.py`

- [ ] **Step 1: Create `pyproject.toml`**

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "gapscope"
version = "0.1.0"
description = "Engineering knowledge-gap analyzer"
requires-python = ">=3.11"
dependencies = [
    "httpx>=0.27",
    "pydantic>=2.6",
    "PyYAML>=6.0",
]

[project.optional-dependencies]
dev = ["pytest>=8.0"]

[project.scripts]
gapscope = "gapscope.cli:main"

[tool.hatch.build.targets.wheel]
packages = ["src/gapscope"]

[tool.pytest.ini_options]
testpaths = ["tests"]
```

- [ ] **Step 2: Create `.gitignore`**

```gitignore
__pycache__/
*.pyc
.venv/
*.egg-info/
.env
.pytest_cache/
```

- [ ] **Step 3: Create `.env.example`**

```bash
# Personal access token (classic or fine-grained) with public-repo read.
# Raises GitHub API rate limit from 60 to 5000 req/hr. Optional but recommended.
GITHUB_TOKEN=
```

- [ ] **Step 4: Create empty package files**

Create `src/gapscope/__init__.py` containing exactly:

```python
"""GapScope — engineering knowledge-gap analyzer."""
```

Create `tests/__init__.py` as an empty file.

- [ ] **Step 5: Create the venv and install (editable, with dev deps)**

Run (PowerShell):
```powershell
py -3.11 -m venv .venv; .\.venv\Scripts\python.exe -m pip install -e ".[dev]"
```
Expected: ends with `Successfully installed ... gapscope-0.1.0 ...`.

- [ ] **Step 6: Verify pytest runs (no tests yet)**

Run:
```powershell
.\.venv\Scripts\python.exe -m pytest -q
```
Expected: `no tests ran` (exit code 5) — confirms pytest + import path work.

- [ ] **Step 7: Commit**

```bash
git add pyproject.toml .gitignore .env.example src/gapscope/__init__.py tests/__init__.py
git commit -m "chore: scaffold gapscope python package"
```

---

## Task 2: Data models (`models.py`)

**Files:**
- Create: `src/gapscope/models.py`
- Test: `tests/test_report.py` (shared with Task 9; this task adds the model test below)

- [ ] **Step 1: Write the failing test**

Create `tests/test_report.py`:

```python
from gapscope.models import Evidence, GapItem, Baseline, Meta, GapReport


def test_gapitem_defaults_and_dump():
    item = GapItem(
        id="langchain",
        name="langchain",
        frequency=3,
        recencyScore=0.5,
        rankScore=0.25,
        evidence=[Evidence(repo="a/b", signal="dependency")],
    )
    dumped = item.model_dump()
    assert dumped["kind"] == "tool"
    assert dumped["docs"] == []
    assert dumped["projects"] == {"small": [], "big": []}
    assert dumped["evidence"][0] == {"repo": "a/b", "signal": "dependency"}


def test_gapreport_dump_shape():
    report = GapReport(
        meta=Meta(generatedAt="2026-06-13T00:00:00+00:00", role="ai-engineer", targetsAnalyzed=2),
        baseline=Baseline(tools=["fastapi"], methods=[]),
        gaps=[],
    )
    dumped = report.model_dump()
    assert set(dumped.keys()) == {"meta", "baseline", "gaps"}
    assert dumped["meta"]["targetsAnalyzed"] == 2
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_report.py -q
```
Expected: FAIL — `ModuleNotFoundError: No module named 'gapscope.models'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/gapscope/models.py`:

```python
from typing import Literal
from pydantic import BaseModel, Field


class Evidence(BaseModel):
    repo: str
    signal: str


class GapItem(BaseModel):
    id: str
    name: str
    kind: Literal["tool", "methodology"] = "tool"
    frequency: int
    recencyScore: float
    rankScore: float
    evidence: list[Evidence] = Field(default_factory=list)
    docs: list[dict] = Field(default_factory=list)
    projects: dict = Field(default_factory=lambda: {"small": [], "big": []})


class Baseline(BaseModel):
    tools: list[str] = Field(default_factory=list)
    methods: list[str] = Field(default_factory=list)


class Meta(BaseModel):
    generatedAt: str
    role: str
    targetsAnalyzed: int


class GapReport(BaseModel):
    meta: Meta
    baseline: Baseline
    gaps: list[GapItem] = Field(default_factory=list)
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_report.py -q
```
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add src/gapscope/models.py tests/test_report.py
git commit -m "feat: add pydantic data models for gap report"
```

---

## Task 3: Manifest parsers (`manifests.py`)

**Files:**
- Create: `src/gapscope/manifests.py`
- Test: `tests/test_manifests.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_manifests.py`:

```python
from gapscope.manifests import (
    normalize_package_name,
    parse_requirements,
    parse_pyproject,
    parse_package_json,
    parse_manifest,
    MANIFEST_NAMES,
)


def test_normalize_strips_version_extras_case():
    assert normalize_package_name("FastAPI==0.110.0") == "fastapi"
    assert normalize_package_name("uvicorn[standard]>=0.27") == "uvicorn"
    assert normalize_package_name("torch ; python_version >= '3.9'") == "torch"
    assert normalize_package_name("@anthropic-ai/sdk") == "@anthropic-ai/sdk"


def test_parse_requirements_ignores_noise():
    text = (
        "# comment\n"
        "FastAPI==0.110.0\n"
        "uvicorn[standard]>=0.27\n"
        "langchain\n"
        "-r other.txt\n"
        "--index-url https://example\n"
        "torch ; python_version >= '3.9'\n"
        "\n"
    )
    assert parse_requirements(text) == {"fastapi", "uvicorn", "langchain", "torch"}


def test_parse_pyproject_pep621_and_optional():
    text = (
        '[project]\n'
        'name = "x"\n'
        'dependencies = ["fastapi>=0.110", "httpx", "pydantic>=2"]\n'
        '[project.optional-dependencies]\n'
        'dev = ["pytest"]\n'
    )
    assert parse_pyproject(text) == {"fastapi", "httpx", "pydantic", "pytest"}


def test_parse_pyproject_poetry_skips_python():
    text = (
        '[tool.poetry.dependencies]\n'
        'python = "^3.11"\n'
        'requests = "^2.31"\n'
    )
    assert parse_pyproject(text) == {"requests"}


def test_parse_package_json_deps_and_dev():
    text = '{"dependencies": {"react": "^18", "next": "14.0.0"}, "devDependencies": {"typescript": "^5"}}'
    assert parse_package_json(text) == {"react", "next", "typescript"}


def test_parse_manifest_dispatch():
    assert parse_manifest("requirements.txt", "flask\n") == {"flask"}
    assert parse_manifest("unknown.txt", "flask\n") == set()
    assert "package.json" in MANIFEST_NAMES
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_manifests.py -q
```
Expected: FAIL — `ModuleNotFoundError: No module named 'gapscope.manifests'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/gapscope/manifests.py`:

```python
import json
import re
import tomllib

_SPLIT = re.compile(r"[<>=!~;\[\s]")


def normalize_package_name(raw: str) -> str:
    """Lowercase a dependency token and strip version specifiers / extras / markers."""
    token = _SPLIT.split(raw.strip(), maxsplit=1)[0]
    return token.strip().lower()


def parse_requirements(text: str) -> set[str]:
    names: set[str] = set()
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("-"):
            continue
        name = normalize_package_name(line)
        if name:
            names.add(name)
    return names


def parse_pyproject(text: str) -> set[str]:
    data = tomllib.loads(text)
    names: set[str] = set()
    project = data.get("project", {})
    for dep in project.get("dependencies", []):
        names.add(normalize_package_name(dep))
    for group in project.get("optional-dependencies", {}).values():
        for dep in group:
            names.add(normalize_package_name(dep))
    poetry = data.get("tool", {}).get("poetry", {}).get("dependencies", {})
    for key in poetry:
        if key.lower() != "python":
            names.add(normalize_package_name(key))
    names.discard("")
    return names


def parse_package_json(text: str) -> set[str]:
    data = json.loads(text)
    names: set[str] = set()
    for section in ("dependencies", "devDependencies"):
        for key in data.get(section, {}):
            names.add(normalize_package_name(key))
    names.discard("")
    return names


PARSERS = {
    "requirements.txt": parse_requirements,
    "pyproject.toml": parse_pyproject,
    "package.json": parse_package_json,
}
MANIFEST_NAMES = list(PARSERS.keys())


def parse_manifest(filename: str, text: str) -> set[str]:
    parser = PARSERS.get(filename)
    return parser(text) if parser else set()
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_manifests.py -q
```
Expected: PASS (6 passed).

- [ ] **Step 5: Commit**

```bash
git add src/gapscope/manifests.py tests/test_manifests.py
git commit -m "feat: add manifest parsers for requirements/pyproject/package.json"
```

---

## Task 4: Config loader (`config.py`)

**Files:**
- Create: `src/gapscope/config.py`, `config/targets.yaml`, `config/baseline_seed.yaml`
- Test: `tests/test_baseline.py` (config test below; baseline test added in Task 7)

- [ ] **Step 1: Write the failing test**

Create `tests/test_baseline.py`:

```python
from gapscope.config import load_targets, load_seed


def test_load_targets(tmp_path):
    p = tmp_path / "targets.yaml"
    p.write_text("you: milanvarghese\nroles:\n  ai-engineer:\n    - alice\n    - bob\n", encoding="utf-8")
    cfg = load_targets(str(p))
    assert cfg["you"] == "milanvarghese"
    assert cfg["roles"]["ai-engineer"] == ["alice", "bob"]


def test_load_seed_missing_returns_empty(tmp_path):
    seed = load_seed(str(tmp_path / "nope.yaml"))
    assert seed == {"tools": [], "methods": []}


def test_load_seed_reads_lists(tmp_path):
    p = tmp_path / "seed.yaml"
    p.write_text("tools:\n  - fastapi\nmethods:\n  - transfer-learning\n", encoding="utf-8")
    seed = load_seed(str(p))
    assert seed["tools"] == ["fastapi"]
    assert seed["methods"] == ["transfer-learning"]
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_baseline.py -q
```
Expected: FAIL — `ModuleNotFoundError: No module named 'gapscope.config'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/gapscope/config.py`:

```python
from pathlib import Path
import yaml


def load_targets(path: str) -> dict:
    return yaml.safe_load(Path(path).read_text(encoding="utf-8"))


def load_seed(path: str) -> dict:
    p = Path(path)
    if not p.exists():
        return {"tools": [], "methods": []}
    data = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
    data.setdefault("tools", [])
    data.setdefault("methods", [])
    return data
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_baseline.py -q
```
Expected: PASS (3 passed).

- [ ] **Step 5: Create the config files**

Create `config/targets.yaml` (replace the example usernames with real ones before a live run):

```yaml
# Your GitHub username — used to build the "what Milan knows" baseline from your repos.
you: milanvarghese

# Target engineers per role. Replace the examples with real usernames you admire.
roles:
  ai-engineer:
    - example-ai-dev-1
    - example-ai-dev-2
  devops:
    - example-devops-1
  security:
    - example-sec-1
```

Create `config/baseline_seed.yaml` (seeded from your résumé; edit freely — this is the "breadth" half of your baseline per spec §3):

```yaml
# Tools/methods you already know but may not have pushed to GitHub.
# GapScope subtracts these so they never show up as gaps.
tools:
  - fastapi
  - postgresql
  - docker
  - azure
  - pytorch
  - mongodb
  - parquet
  - yolov3
  - layoutlm
methods:
  - transfer-learning
  - hyperparameter-tuning
  - document-understanding
```

- [ ] **Step 6: Commit**

```bash
git add src/gapscope/config.py config/targets.yaml config/baseline_seed.yaml tests/test_baseline.py
git commit -m "feat: add config loader and seed config files"
```

---

## Task 5: GitHub client (`github_client.py`)

**Files:**
- Create: `src/gapscope/github_client.py`
- Test: `tests/test_github_client.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_github_client.py`:

```python
import base64
import httpx
from gapscope.github_client import GitHubClient


def _make_client(handler):
    http = httpx.Client(base_url="https://api.github.com", transport=httpx.MockTransport(handler))
    return GitHubClient(http=http)


def test_list_repos_sends_recency_params_and_returns_json():
    captured = {}

    def handler(request):
        captured["path"] = request.url.path
        captured["query"] = dict(request.url.params)
        return httpx.Response(200, json=[{"name": "r1"}])

    client = _make_client(handler)
    repos = client.list_repos("alice")
    assert repos == [{"name": "r1"}]
    assert captured["path"] == "/users/alice/repos"
    assert captured["query"]["sort"] == "pushed"
    assert captured["query"]["direction"] == "desc"


def test_get_file_decodes_base64():
    content = base64.b64encode(b"flask\n").decode()

    def handler(request):
        return httpx.Response(200, json={"content": content, "encoding": "base64"})

    client = _make_client(handler)
    assert client.get_file("alice", "r1", "requirements.txt") == "flask\n"


def test_get_file_returns_none_on_404():
    def handler(request):
        return httpx.Response(404, json={"message": "Not Found"})

    client = _make_client(handler)
    assert client.get_file("alice", "r1", "requirements.txt") is None
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_github_client.py -q
```
Expected: FAIL — `ModuleNotFoundError: No module named 'gapscope.github_client'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/gapscope/github_client.py`:

```python
import base64
import httpx

API_BASE = "https://api.github.com"


class GitHubClient:
    """Thin wrapper over the GitHub REST API. HTTP only — no parsing logic."""

    def __init__(self, token: str | None = None, http: httpx.Client | None = None):
        if http is not None:
            self._http = http
        else:
            headers = {"Accept": "application/vnd.github+json"}
            if token:
                headers["Authorization"] = f"Bearer {token}"
            self._http = httpx.Client(base_url=API_BASE, headers=headers, timeout=30.0)

    def list_repos(self, username: str) -> list[dict]:
        resp = self._http.get(
            f"/users/{username}/repos",
            params={"sort": "pushed", "direction": "desc", "per_page": 100},
        )
        resp.raise_for_status()
        return resp.json()

    def get_file(self, owner: str, repo: str, path: str) -> str | None:
        resp = self._http.get(f"/repos/{owner}/{repo}/contents/{path}")
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        data = resp.json()
        return base64.b64decode(data["content"]).decode("utf-8", errors="replace")
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_github_client.py -q
```
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add src/gapscope/github_client.py tests/test_github_client.py
git commit -m "feat: add GitHub REST client (list_repos, get_file)"
```

---

## Task 6: Harvester (`harvester.py`)

**Files:**
- Create: `src/gapscope/harvester.py`
- Test: `tests/test_harvester.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_harvester.py`:

```python
from datetime import datetime, timezone
from gapscope.harvester import harvest_user, ExtractedRepo


class FakeClient:
    """In-memory stand-in for GitHubClient."""

    def __init__(self, repos, files):
        self._repos = repos          # dict: username -> list[repo dict]
        self._files = files          # dict: (repo_name, path) -> text or None

    def list_repos(self, username):
        return self._repos.get(username, [])

    def get_file(self, owner, repo, path):
        return self._files.get((repo, path))


def _repo(name, pushed, fork=False, archived=False):
    return {
        "name": name,
        "full_name": f"alice/{name}",
        "owner": {"login": "alice"},
        "pushed_at": pushed,
        "fork": fork,
        "archived": archived,
    }


def test_harvest_filters_and_extracts_recency_first():
    repos = {
        "alice": [
            _repo("fresh", "2026-06-01T00:00:00Z"),
            _repo("forked", "2026-05-20T00:00:00Z", fork=True),
            _repo("archived", "2026-05-19T00:00:00Z", archived=True),
            _repo("nomanifest", "2026-05-18T00:00:00Z"),
            _repo("older", "2026-04-01T00:00:00Z"),
        ]
    }
    files = {
        ("fresh", "requirements.txt"): "langchain\nfastapi\n",
        ("older", "package.json"): '{"dependencies": {"react": "^18"}}',
        # nomanifest, forked, archived: no files registered -> get_file returns None
    }
    out = harvest_user(FakeClient(repos, files), "alice", top_n=10)

    names = [r.full_name for r in out]
    assert names == ["alice/fresh", "alice/older"]            # fork/archived/no-manifest dropped
    assert out[0].tools == {"langchain", "fastapi"}
    assert out[1].tools == {"react"}
    assert out[0].pushed_at == datetime(2026, 6, 1, tzinfo=timezone.utc)


def test_harvest_respects_top_n():
    repos = {
        "alice": [
            _repo("a", "2026-06-03T00:00:00Z"),
            _repo("b", "2026-06-02T00:00:00Z"),
            _repo("c", "2026-06-01T00:00:00Z"),
        ]
    }
    files = {
        ("a", "requirements.txt"): "flask\n",
        ("b", "requirements.txt"): "django\n",
        ("c", "requirements.txt"): "fastapi\n",
    }
    out = harvest_user(FakeClient(repos, files), "alice", top_n=2)
    assert [r.full_name for r in out] == ["alice/a", "alice/b"]
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_harvester.py -q
```
Expected: FAIL — `ModuleNotFoundError: No module named 'gapscope.harvester'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/gapscope/harvester.py`:

```python
from dataclasses import dataclass, field
from datetime import datetime

from .manifests import parse_manifest, MANIFEST_NAMES


@dataclass
class ExtractedRepo:
    full_name: str
    owner: str
    pushed_at: datetime
    tools: set[str] = field(default_factory=set)


def _parse_dt(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def harvest_user(client, username: str, top_n: int = 10, manifest_names=MANIFEST_NAMES):
    """Select a user's recent, non-fork, non-archived repos that have a dependency
    manifest, newest first, up to top_n. Returns ExtractedRepo per kept repo.

    `client.list_repos` already returns repos sorted by pushed-desc (recency-first).
    """
    out: list[ExtractedRepo] = []
    for repo in client.list_repos(username):
        if repo.get("fork") or repo.get("archived"):
            continue
        owner = repo["owner"]["login"]
        name = repo["name"]
        tools: set[str] = set()
        for manifest in manifest_names:
            text = client.get_file(owner, name, manifest)
            if text:
                tools |= parse_manifest(manifest, text)
        if not tools:
            continue
        out.append(
            ExtractedRepo(
                full_name=repo["full_name"],
                owner=username,
                pushed_at=_parse_dt(repo["pushed_at"]),
                tools=tools,
            )
        )
        if len(out) >= top_n:
            break
    return out
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_harvester.py -q
```
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add src/gapscope/harvester.py tests/test_harvester.py
git commit -m "feat: add repo harvester (recency-first, manifest-filtered)"
```

---

## Task 7: Baseline builder (`baseline.py`)

**Files:**
- Create: `src/gapscope/baseline.py`
- Test: append to `tests/test_baseline.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_baseline.py`:

```python
from datetime import datetime, timezone
from gapscope.baseline import build_baseline
from gapscope.harvester import ExtractedRepo


def _erepo(name, tools):
    return ExtractedRepo(full_name=f"milanvarghese/{name}", owner="milanvarghese",
                         pushed_at=datetime(2026, 1, 1, tzinfo=timezone.utc), tools=set(tools))


def test_build_baseline_merges_repos_and_seed_lowercased_sorted():
    own = [_erepo("a", {"FastAPI", "httpx"}), _erepo("b", {"pytest"})]
    seed = {"tools": ["Docker", "fastapi"], "methods": ["Transfer-Learning"]}
    baseline = build_baseline(own, seed)
    assert baseline.tools == ["docker", "fastapi", "httpx", "pytest"]
    assert baseline.methods == ["transfer-learning"]
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_baseline.py::test_build_baseline_merges_repos_and_seed_lowercased_sorted -q
```
Expected: FAIL — `ModuleNotFoundError: No module named 'gapscope.baseline'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/gapscope/baseline.py`:

```python
from .models import Baseline


def build_baseline(own_repos, seed: dict) -> Baseline:
    """Merge tools extracted from the user's own repos with the manual seed list.
    Everything lowercased + sorted so gap subtraction is case-insensitive."""
    tools = {t.lower() for t in seed.get("tools", [])}
    for repo in own_repos:
        tools |= {t.lower() for t in repo.tools}
    methods = {m.lower() for m in seed.get("methods", [])}
    return Baseline(tools=sorted(tools), methods=sorted(methods))
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_baseline.py -q
```
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add src/gapscope/baseline.py tests/test_baseline.py
git commit -m "feat: add baseline builder (own repos + seed)"
```

---

## Task 8: Gap computer + ranker (`gaps.py`)

**Files:**
- Create: `src/gapscope/gaps.py`
- Test: `tests/test_gaps.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_gaps.py`:

```python
from datetime import datetime, timezone
from gapscope.gaps import compute_gaps
from gapscope.harvester import ExtractedRepo
from gapscope.models import Baseline


def _erepo(owner, name, tools, pushed):
    return ExtractedRepo(full_name=f"{owner}/{name}", owner=owner,
                         pushed_at=datetime.fromisoformat(pushed), tools=set(tools))


def test_baseline_tools_excluded():
    targets = [_erepo("alice", "x", {"fastapi", "langchain"}, "2026-06-01T00:00:00+00:00")]
    baseline = Baseline(tools=["fastapi"], methods=[])
    gaps = compute_gaps(targets, baseline)
    assert [g.id for g in gaps] == ["langchain"]


def test_frequency_counts_distinct_owners_and_ranks():
    # langchain: used by alice + bob (freq 2), most recent push 2026-06-10
    # mcp:       used by alice only      (freq 1), most recent push 2026-06-20 (newer)
    targets = [
        _erepo("alice", "r1", {"langchain"}, "2026-06-01T00:00:00+00:00"),
        _erepo("alice", "r2", {"mcp"}, "2026-06-20T00:00:00+00:00"),
        _erepo("bob", "r3", {"langchain"}, "2026-06-10T00:00:00+00:00"),
    ]
    gaps = compute_gaps(targets, Baseline(tools=[], methods=[]))
    by_id = {g.id: g for g in gaps}

    assert by_id["langchain"].frequency == 2
    assert by_id["mcp"].frequency == 1
    # recency normalized across {2026-06-10, 2026-06-20}: langchain=0.0, mcp=1.0
    assert by_id["mcp"].recencyScore == 1.0
    assert by_id["langchain"].recencyScore == 0.0
    # rankScore = norm_freq * norm_recency -> langchain = (2/2)*0.0 = 0.0 ; mcp = (1/2)*1.0 = 0.5
    assert by_id["mcp"].rankScore == 0.5
    assert by_id["langchain"].rankScore == 0.0
    # sorted by rankScore desc -> mcp first
    assert [g.id for g in gaps] == ["mcp", "langchain"]


def test_single_gap_recency_is_one():
    targets = [_erepo("alice", "r1", {"solo"}, "2026-06-01T00:00:00+00:00")]
    gaps = compute_gaps(targets, Baseline(tools=[], methods=[]))
    assert gaps[0].recencyScore == 1.0
    assert gaps[0].rankScore == 1.0


def test_evidence_dedup_and_capped():
    targets = [_erepo("alice", f"r{i}", {"tool"}, "2026-06-01T00:00:00+00:00") for i in range(7)]
    gaps = compute_gaps(targets, Baseline(tools=[], methods=[]))
    assert len(gaps[0].evidence) == 5
    assert all(e.signal == "dependency" for e in gaps[0].evidence)
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_gaps.py -q
```
Expected: FAIL — `ModuleNotFoundError: No module named 'gapscope.gaps'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/gapscope/gaps.py`:

```python
from datetime import datetime

from .models import Baseline, Evidence, GapItem


def compute_gaps(target_repos, baseline: Baseline) -> list[GapItem]:
    """Gap = tools in targets' repos that are not in the baseline.
    Ranked by normalize(frequency) * normalize(recency)."""
    base = set(baseline.tools)

    agg: dict[str, dict] = {}
    for repo in target_repos:
        for tool in repo.tools:
            tool = tool.lower()
            if tool in base:
                continue
            entry = agg.setdefault(tool, {"owners": set(), "repos": [], "recent": repo.pushed_at})
            entry["owners"].add(repo.owner)
            entry["repos"].append(repo.full_name)
            if repo.pushed_at > entry["recent"]:
                entry["recent"] = repo.pushed_at

    if not agg:
        return []

    max_freq = max(len(e["owners"]) for e in agg.values())
    recents: list[datetime] = [e["recent"] for e in agg.values()]
    min_t, max_t = min(recents), max(recents)
    span = (max_t - min_t).total_seconds()

    items: list[GapItem] = []
    for tool, entry in agg.items():
        freq = len(entry["owners"])
        norm_freq = freq / max_freq
        norm_recency = 1.0 if span == 0 else (entry["recent"] - min_t).total_seconds() / span
        rank = round(norm_freq * norm_recency, 4)
        evidence = [Evidence(repo=r, signal="dependency") for r in sorted(set(entry["repos"]))[:5]]
        items.append(
            GapItem(
                id=tool,
                name=tool,
                kind="tool",
                frequency=freq,
                recencyScore=round(norm_recency, 4),
                rankScore=rank,
                evidence=evidence,
            )
        )

    items.sort(key=lambda g: (g.rankScore, g.frequency), reverse=True)
    return items
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_gaps.py -q
```
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add src/gapscope/gaps.py tests/test_gaps.py
git commit -m "feat: add gap computer and frequency x recency ranker"
```

---

## Task 9: Report builder/writer (`report.py`)

**Files:**
- Create: `src/gapscope/report.py`
- Test: append to `tests/test_report.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_report.py`:

```python
import json
from gapscope.report import build_report, write_report


def test_build_and_write_report(tmp_path):
    baseline = Baseline(tools=["fastapi"], methods=[])
    gaps = [GapItem(id="langchain", name="langchain", frequency=2, recencyScore=1.0, rankScore=1.0,
                    evidence=[Evidence(repo="a/b", signal="dependency")])]
    report = build_report("ai-engineer", baseline, gaps, targets_analyzed=3,
                          generated_at="2026-06-13T00:00:00+00:00")
    assert report.meta.role == "ai-engineer"
    assert report.meta.targetsAnalyzed == 3

    out = tmp_path / "data.json"
    write_report(report, str(out))
    loaded = json.loads(out.read_text(encoding="utf-8"))
    assert loaded["gaps"][0]["id"] == "langchain"
    assert loaded["meta"]["generatedAt"] == "2026-06-13T00:00:00+00:00"
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_report.py -q
```
Expected: FAIL — `ModuleNotFoundError: No module named 'gapscope.report'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/gapscope/report.py`:

```python
import json
from pathlib import Path

from .models import Baseline, GapItem, GapReport, Meta


def build_report(role: str, baseline: Baseline, gaps: list[GapItem],
                 targets_analyzed: int, generated_at: str) -> GapReport:
    return GapReport(
        meta=Meta(generatedAt=generated_at, role=role, targetsAnalyzed=targets_analyzed),
        baseline=baseline,
        gaps=gaps,
    )


def write_report(report: GapReport, path: str) -> None:
    Path(path).write_text(json.dumps(report.model_dump(), indent=2), encoding="utf-8")
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_report.py -q
```
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add src/gapscope/report.py tests/test_report.py
git commit -m "feat: add report builder and data.json writer"
```

---

## Task 10: CLI wiring + integration test (`cli.py`)

**Files:**
- Create: `src/gapscope/cli.py`
- Test: `tests/test_cli_integration.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_cli_integration.py`:

```python
import json
from gapscope import cli


class FakeClient:
    def __init__(self, repos, files):
        self._repos, self._files = repos, files

    def list_repos(self, username):
        return self._repos.get(username, [])

    def get_file(self, owner, repo, path):
        return self._files.get((repo, path))


def _repo(owner, name, pushed):
    return {"name": name, "full_name": f"{owner}/{name}", "owner": {"login": owner},
            "pushed_at": pushed, "fork": False, "archived": False}


def test_run_sweep_end_to_end(tmp_path, monkeypatch):
    repos = {
        "milanvarghese": [_repo("milanvarghese", "mine", "2026-01-01T00:00:00Z")],
        "alice": [_repo("alice", "agent", "2026-06-01T00:00:00Z")],
    }
    files = {
        ("mine", "requirements.txt"): "fastapi\n",          # baseline knows fastapi
        ("agent", "requirements.txt"): "fastapi\nlangchain\n",  # gap = langchain
    }
    fake = FakeClient(repos, files)
    monkeypatch.setattr(cli, "GitHubClient", lambda token=None: fake)

    targets = tmp_path / "targets.yaml"
    targets.write_text("you: milanvarghese\nroles:\n  ai-engineer:\n    - alice\n", encoding="utf-8")
    seed = tmp_path / "seed.yaml"
    seed.write_text("tools: []\nmethods: []\n", encoding="utf-8")
    out = tmp_path / "data.json"

    rc = cli.main([
        "sweep", "--role", "ai-engineer",
        "--config", str(targets), "--baseline-seed", str(seed),
        "--out", str(out), "--top-n", "10",
    ])
    assert rc == 0

    data = json.loads(out.read_text(encoding="utf-8"))
    assert "fastapi" in data["baseline"]["tools"]
    assert [g["id"] for g in data["gaps"]] == ["langchain"]   # fastapi filtered by baseline
    assert data["meta"]["role"] == "ai-engineer"
    assert data["meta"]["targetsAnalyzed"] == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_cli_integration.py -q
```
Expected: FAIL — `ModuleNotFoundError: No module named 'gapscope.cli'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/gapscope/cli.py`:

```python
import argparse
import os
from datetime import datetime, timezone

from .baseline import build_baseline
from .config import load_seed, load_targets
from .gaps import compute_gaps
from .github_client import GitHubClient
from .harvester import harvest_user
from .report import build_report, write_report


def run_sweep(args) -> int:
    cfg = load_targets(args.config)
    seed = load_seed(args.baseline_seed)

    client = GitHubClient(token=os.environ.get("GITHUB_TOKEN"))

    own = harvest_user(client, cfg["you"], top_n=args.top_n)
    baseline = build_baseline(own, seed)

    usernames = cfg["roles"][args.role]
    target_repos = []
    for user in usernames:
        target_repos.extend(harvest_user(client, user, top_n=args.top_n))

    gaps = compute_gaps(target_repos, baseline)
    generated_at = datetime.now(timezone.utc).isoformat()
    report = build_report(args.role, baseline, gaps, len(usernames), generated_at)
    write_report(report, args.out)

    print(f"Wrote {args.out}: {len(gaps)} gaps from {len(usernames)} targets (role={args.role})")
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="gapscope")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sweep = sub.add_parser("sweep", help="Run a gap sweep and write data.json")
    sweep.add_argument("--role", required=True, help="Role key from targets.yaml")
    sweep.add_argument("--config", default="config/targets.yaml")
    sweep.add_argument("--baseline-seed", default="config/baseline_seed.yaml")
    sweep.add_argument("--out", default="data.json")
    sweep.add_argument("--top-n", type=int, default=10)

    args = parser.parse_args(argv)
    if args.cmd == "sweep":
        return run_sweep(args)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_cli_integration.py -q
```
Expected: PASS (1 passed).

- [ ] **Step 5: Run the FULL test suite**

Run:
```powershell
.\.venv\Scripts\python.exe -m pytest -q
```
Expected: PASS (all tests across the 7 test files green).

- [ ] **Step 6: Commit**

```bash
git add src/gapscope/cli.py tests/test_cli_integration.py
git commit -m "feat: wire CLI sweep end-to-end"
```

---

## Task 11: README + live smoke test

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# GapScope — Engineering Knowledge-Gap Analyzer

Finds the delta between what you know and what accomplished engineers actually use.
Plan 1 (this stage) is the deterministic engine: it mines target GitHub users' recent
repos, extracts their tools, subtracts your baseline, and writes a ranked `data.json`.
No LLM/API cost.

## Setup

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
copy .env.example .env   # then add a GITHUB_TOKEN (optional, raises rate limit)
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
```

- [ ] **Step 2: Live smoke test (manual — requires network + real usernames)**

Set `config/targets.yaml` `you:` to `milanvarghese` and add 1–2 real GitHub usernames
under `ai-engineer`. Then run:

```powershell
.\.venv\Scripts\gapscope.exe sweep --role ai-engineer --out data.json
```

Acceptance: command exits 0, prints `Wrote data.json: N gaps ...`, and `data.json`
contains a non-empty `gaps` array sorted by `rankScore` descending, with `baseline.tools`
populated. (If you hit rate limits, set `GITHUB_TOKEN`.)

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup, run, and smoke-test instructions"
```

- [ ] **Step 4: Push to GitHub**

```bash
git push -u origin main
```

---

## Self-Review

**Spec coverage (Plan 1 scope only):**
- §3 baseline (own repos + seed) → Tasks 6, 7. ✅ *(Résumé auto-parse via LLM is deferred to Plan 2; the seed file represents résumé breadth, consistent with §3's "editable baseline.")*
- §4 targets (manual + role defaults, recency-first, fork/archived/manifest filters) → Tasks 4, 6. ✅
- §5 stages 1–4, 6, 7, 9 (deterministic) → Tasks 6 (harvest+extract), 7 (baseline), 8 (gap+rank), 9 (write). ✅
- §5 stages 5, 5.5, 8 (LLM: methodologies, resolver, recommender) → **deferred to Plan 2** (by design).
- §8 data.json schema → Tasks 2, 9. `docs`/`projects` emitted empty, `kind="tool"` only — valid partial document Plan 2 enriches. ✅

**Known simplification (documented):** `recencyScore` is derived from each repo's `pushed_at` (most recent push of any repo using a tool), not from per-dependency git history as §8's comment phrases it. Per-dependency commit archaeology is expensive; the push-date proxy is deterministic and sufficient for ranking. Revisit only if ranking quality demands it.

**Placeholder scan:** No TBD/TODO; every code step contains complete code. Config files contain example usernames the user replaces before a live run (not plan placeholders). ✅

**Type consistency:** `ExtractedRepo` fields (`full_name`, `owner`, `pushed_at`, `tools`) consistent across Tasks 6–8/10. `compute_gaps(target_repos, baseline)`, `build_baseline(own_repos, seed)`, `build_report(role, baseline, gaps, targets_analyzed, generated_at)`, `GitHubClient(token=, http=)`, `harvest_user(client, username, top_n=)` signatures match every call site. Model field names (`recencyScore`, `rankScore`, `generatedAt`, `targetsAnalyzed`) consistent between `models.py` and all tests. ✅
