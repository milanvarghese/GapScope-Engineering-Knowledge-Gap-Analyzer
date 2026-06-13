# GapScope Plan 2 — Denoise + LLM Enrichment Implementation Plan

> **For agentic workers:** implement task-by-task with TDD. Each task: write failing test → run (fail) → implement → run (pass) → commit. Run commands from the repo root with the venv python (Bash tool: forward slashes — `./.venv/Scripts/python.exe`).

**Goal:** Make the gap list meaningful (denoise scaffold/transitive deps) and, behind an opt-in `--enrich` flag, add LLM-inferred methodologies, researched explanations of unknowns, and verified study recommendations.

**Architecture:** Denoise is free, deterministic, always-on (applied in gap computation). LLM enrichment is gated behind `--enrich` + `ANTHROPIC_API_KEY`: a thin injectable Anthropic wrapper (`llm.py`) with a SHA-keyed disk cache (`cache.py`), used by `methodology.py` (README→tags), `resolver.py` (research unknowns), and `recommender.py` (verified docs + projects via `links.py`).

**Tech Stack:** Python 3.11+ (machine has 3.14), `anthropic` SDK (`messages.parse()` + Pydantic structured output, model `claude-haiku-4-5`), `httpx`, `pydantic` v2, `PyYAML`, `pytest`. All LLM/network mocked in tests.

**Spec:** `docs/superpowers/specs/2026-06-13-gapscope-plan2-llm-enrichment-design.md`.

**SDK facts (from claude-api skill):** `anthropic.Anthropic()` reads `ANTHROPIC_API_KEY` from env. Use `client.messages.parse(model=..., max_tokens=..., system=..., messages=[{"role":"user","content":...}], output_format=PydanticModel)` → `.parsed_output` is a validated instance. Haiku 4.5 supports structured outputs. Do NOT pass `temperature`/`thinking`/`effort` (Haiku doesn't take effort; keep calls minimal). Inject the client for tests.

---

## Task 1: Denoise (denylist + grouping), wired into ranking

**Files:** Create `src/gapscope/denoise.py`, `config/tool_denylist.yaml`, `config/tool_groups.yaml`, `tests/test_denoise.py`. Modify `src/gapscope/gaps.py`, `src/gapscope/cli.py`.

- [ ] **Step 1 — failing test** `tests/test_denoise.py`:

```python
from gapscope.denoise import load_denoise_rules, apply_denoise


RULES = {
    "denylist_exact": {"postcss", "autoprefixer", "eslint"},
    "denylist_prefix": ("@types/",),
    "groups": {"@radix-ui/react-dialog": "shadcn/ui", "clsx": "shadcn/ui", "@radix-ui/react-tabs": "shadcn/ui"},
}


def test_denylist_drops_exact_and_prefix():
    tools = {"react", "postcss", "@types/node", "fastapi"}
    assert apply_denoise(tools, RULES) == {"react", "fastapi"}


def test_grouping_folds_family_to_one_concept():
    tools = {"@radix-ui/react-dialog", "@radix-ui/react-tabs", "clsx", "react"}
    out = apply_denoise(tools, RULES)
    assert out == {"shadcn/ui", "react"}   # three members collapse to one group


def test_load_rules_from_yaml(tmp_path):
    deny = tmp_path / "deny.yaml"
    deny.write_text("exact:\n  - eslint\nprefix:\n  - '@types/'\n", encoding="utf-8")
    groups = tmp_path / "groups.yaml"
    groups.write_text("shadcn/ui:\n  - clsx\n  - vaul\n", encoding="utf-8")
    rules = load_denoise_rules(str(deny), str(groups))
    assert "eslint" in rules["denylist_exact"]
    assert rules["denylist_prefix"] == ("@types/",)
    assert rules["groups"]["clsx"] == "shadcn/ui"
    assert rules["groups"]["vaul"] == "shadcn/ui"
```

- [ ] **Step 2 — run, expect fail** (`ModuleNotFoundError: gapscope.denoise`).

- [ ] **Step 3 — implement** `src/gapscope/denoise.py`:

```python
from pathlib import Path
import yaml


def load_denoise_rules(denylist_path: str, groups_path: str) -> dict:
    """Load denylist (exact names + name prefixes) and grouping map (member -> group)."""
    deny = yaml.safe_load(Path(denylist_path).read_text(encoding="utf-8")) or {}
    groups_raw = yaml.safe_load(Path(groups_path).read_text(encoding="utf-8")) or {}
    member_to_group: dict[str, str] = {}
    for group, members in groups_raw.items():
        for member in members or []:
            member_to_group[member.lower()] = group
    return {
        "denylist_exact": {x.lower() for x in deny.get("exact", [])},
        "denylist_prefix": tuple(p.lower() for p in deny.get("prefix", [])),
        "groups": member_to_group,
    }


def apply_denoise(tools: set[str], rules: dict) -> set[str]:
    """Drop denylisted tools (exact + prefix); fold grouped members into their group id.
    Anything not listed passes through unchanged (open-ended principle preserved)."""
    exact = rules["denylist_exact"]
    prefixes = rules["denylist_prefix"]
    groups = rules["groups"]
    out: set[str] = set()
    for tool in tools:
        t = tool.lower()
        if t in exact or any(t.startswith(p) for p in prefixes):
            continue
        out.add(groups.get(t, t))
    return out
```

- [ ] **Step 4 — run test, expect 3 passed.**

- [ ] **Step 5 — create config files.** `config/tool_denylist.yaml`:

```yaml
# Packages that are not learnable skills — type stubs and build/lint tooling.
exact:
  - postcss
  - autoprefixer
  - eslint
  - eslint-config-next
  - prettier
  - ts-node
  - tsx
prefix:
  - "@types/"
```

`config/tool_groups.yaml`:

```yaml
# Dependency families that represent ONE learnable concept.
shadcn/ui:
  - clsx
  - tailwind-merge
  - class-variance-authority
  - tailwindcss-animate
  - lucide-react
  - cmdk
  - vaul
  - sonner
  - "@radix-ui/react-dialog"
  - "@radix-ui/react-dropdown-menu"
  - "@radix-ui/react-popover"
  - "@radix-ui/react-tabs"
  - "@radix-ui/react-tooltip"
  - "@radix-ui/react-select"
  - "@radix-ui/react-accordion"
  - "@radix-ui/react-avatar"
  - "@radix-ui/react-checkbox"
  - "@radix-ui/react-label"
  - "@radix-ui/react-slot"
  - "@radix-ui/react-switch"
  - "@radix-ui/react-toast"
```

- [ ] **Step 6 — wire into `gaps.py`.** Read `src/gapscope/gaps.py`. Change the signature of `compute_gaps` to accept optional denoise rules and apply them to each repo's tool set before aggregation:

Change `def compute_gaps(target_repos, baseline: Baseline) -> list[GapItem]:` to:
```python
def compute_gaps(target_repos, baseline: Baseline, denoise_rules: dict | None = None) -> list[GapItem]:
```
Add this import at the top: `from .denoise import apply_denoise`.
Inside the loop, replace `for tool in repo.tools:` with:
```python
        tools = apply_denoise(repo.tools, denoise_rules) if denoise_rules else repo.tools
        for tool in tools:
```
(Everything else in `compute_gaps` stays identical.)

- [ ] **Step 7 — wire into `cli.py`.** Read `src/gapscope/cli.py`. Add import `from .denoise import load_denoise_rules`. In `run_sweep`, before `gaps = compute_gaps(...)`, add:
```python
    denoise_rules = load_denoise_rules("config/tool_denylist.yaml", "config/tool_groups.yaml")
```
and change the call to `gaps = compute_gaps(target_repos, baseline, denoise_rules)`.

Add CLI args to the `sweep` parser (for later tasks; harmless now):
```python
    sweep.add_argument("--enrich", action="store_true", help="LLM enrichment (needs ANTHROPIC_API_KEY)")
    sweep.add_argument("--research-top", type=int, default=15)
```

- [ ] **Step 8 — run FULL suite, expect all green** (existing gaps/cli tests still pass — `compute_gaps` denoise arg is optional, so they're unaffected).

- [ ] **Step 9 — commit:** `git add -A && git commit -m "feat: deterministic denoise (denylist + grouping) in gap ranking"`

---

## Task 2: LLM client wrapper (`llm.py`)

**Files:** Create `src/gapscope/llm.py`, `config/llm.yaml`, `tests/test_llm.py`.

- [ ] **Step 1 — failing test** `tests/test_llm.py`:

```python
from pydantic import BaseModel
from gapscope.llm import LLMClient, load_llm_config


class _Out(BaseModel):
    answer: str


class FakeMessages:
    def __init__(self, recorder):
        self._recorder = recorder

    def parse(self, *, model, max_tokens, system, messages, output_format):
        self._recorder["model"] = model
        self._recorder["system"] = system

        class _Resp:
            parsed_output = output_format(answer="ok")
        return _Resp()


class FakeAnthropic:
    def __init__(self):
        self.recorder = {}
        self.messages = FakeMessages(self.recorder)


def test_llm_parse_returns_validated_model():
    fake = FakeAnthropic()
    llm = LLMClient(model="claude-haiku-4-5", client=fake)
    out = llm.parse(system="sys", user="hi", schema=_Out)
    assert isinstance(out, _Out)
    assert out.answer == "ok"
    assert fake.recorder["model"] == "claude-haiku-4-5"
    assert fake.recorder["system"] == "sys"


def test_load_llm_config_default(tmp_path):
    p = tmp_path / "llm.yaml"
    p.write_text("model: claude-haiku-4-5\nmax_tokens: 1024\n", encoding="utf-8")
    cfg = load_llm_config(str(p))
    assert cfg["model"] == "claude-haiku-4-5"
    assert cfg["max_tokens"] == 1024
```

- [ ] **Step 2 — run, expect fail.**

- [ ] **Step 3 — implement** `src/gapscope/llm.py`:

```python
from pathlib import Path
import yaml


class LLMClient:
    """Thin wrapper over the Anthropic SDK. Inject `client` for tests.
    Uses messages.parse() for schema-validated structured output."""

    def __init__(self, model: str = "claude-haiku-4-5", max_tokens: int = 1024, client=None):
        self.model = model
        self.max_tokens = max_tokens
        if client is not None:
            self._client = client
        else:
            import anthropic  # imported lazily so tests need no SDK/key
            self._client = anthropic.Anthropic()

    def parse(self, *, system: str, user: str, schema):
        resp = self._client.messages.parse(
            model=self.model,
            max_tokens=self.max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
            output_format=schema,
        )
        return resp.parsed_output


def load_llm_config(path: str) -> dict:
    p = Path(path)
    data = yaml.safe_load(p.read_text(encoding="utf-8")) if p.exists() else {}
    data = data or {}
    data.setdefault("model", "claude-haiku-4-5")
    data.setdefault("max_tokens", 1024)
    return data
```

- [ ] **Step 4 — run, expect 2 passed.**

- [ ] **Step 5 — create** `config/llm.yaml`:
```yaml
# Model for LLM enrichment. Haiku keeps cost near-trivial (see spec §3).
model: claude-haiku-4-5
max_tokens: 1024
```

- [ ] **Step 6 — commit:** `git add -A && git commit -m "feat: injectable Anthropic LLM client wrapper"`

---

## Task 3: SHA-keyed disk cache (`cache.py`)

**Files:** Create `src/gapscope/cache.py`, `tests/test_cache.py`. Modify `.gitignore`.

- [ ] **Step 1 — failing test** `tests/test_cache.py`:

```python
from gapscope.cache import DiskCache


def test_cache_round_trips_json(tmp_path):
    cache = DiskCache(str(tmp_path / "cache"))
    assert cache.get("k1") is None
    cache.set("k1", {"a": 1, "b": ["x"]})
    assert cache.get("k1") == {"a": 1, "b": ["x"]}


def test_cache_key_is_content_addressed(tmp_path):
    cache = DiskCache(str(tmp_path / "cache"))
    k_a = cache.key("haiku", "prompt one")
    k_b = cache.key("haiku", "prompt one")
    k_c = cache.key("haiku", "prompt two")
    assert k_a == k_b
    assert k_a != k_c


def test_cache_persists_across_instances(tmp_path):
    d = str(tmp_path / "cache")
    DiskCache(d).set("k2", {"v": 2})
    assert DiskCache(d).get("k2") == {"v": 2}
```

- [ ] **Step 2 — run, expect fail.**

- [ ] **Step 3 — implement** `src/gapscope/cache.py`:

```python
import hashlib
import json
from pathlib import Path


class DiskCache:
    """Content-addressed JSON cache. Keys by SHA-256 so identical (model, prompt)
    pairs are served from disk instead of re-paying the LLM."""

    def __init__(self, root: str = ".gapscope_cache"):
        self._root = Path(root)
        self._root.mkdir(parents=True, exist_ok=True)

    def key(self, model: str, prompt: str) -> str:
        return hashlib.sha256(f"{model}\x00{prompt}".encode("utf-8")).hexdigest()

    def _path(self, key: str) -> Path:
        return self._root / f"{key}.json"

    def get(self, key: str):
        p = self._path(key)
        if not p.exists():
            return None
        return json.loads(p.read_text(encoding="utf-8"))

    def set(self, key: str, value) -> None:
        self._path(key).write_text(json.dumps(value), encoding="utf-8")
```

- [ ] **Step 4 — run, expect 3 passed.**

- [ ] **Step 5 — add `.gapscope_cache/` to `.gitignore`** (append a line).

- [ ] **Step 6 — commit:** `git add -A && git commit -m "feat: SHA-keyed disk cache for LLM calls"`

---

## Task 4: Link verification (`links.py`)

**Files:** Create `src/gapscope/links.py`, `tests/test_links.py`.

- [ ] **Step 1 — failing test** `tests/test_links.py`:

```python
import httpx
from gapscope.links import verify_url


def _client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_verify_url_true_on_200():
    def handler(request):
        return httpx.Response(200)
    assert verify_url("https://example.com/docs", http=_client(handler)) is True


def test_verify_url_false_on_404():
    def handler(request):
        return httpx.Response(404)
    assert verify_url("https://example.com/missing", http=_client(handler)) is False


def test_verify_url_false_on_connection_error():
    def handler(request):
        raise httpx.ConnectError("boom")
    assert verify_url("https://nope.invalid", http=_client(handler)) is False
```

- [ ] **Step 2 — run, expect fail.**

- [ ] **Step 3 — implement** `src/gapscope/links.py`:

```python
import httpx


def verify_url(url: str, http: httpx.Client | None = None) -> bool:
    """True if the URL resolves to a 2xx/3xx response. Network errors -> False.
    Never raises — a dead link must never ship as 'verified'."""
    own = http is None
    client = http or httpx.Client(timeout=10.0, follow_redirects=True)
    try:
        resp = client.get(url)
        return resp.status_code < 400
    except httpx.HTTPError:
        return False
    finally:
        if own:
            client.close()
```

- [ ] **Step 4 — run, expect 3 passed.**

- [ ] **Step 5 — commit:** `git add -A && git commit -m "feat: HTTP link verification (no fabricated docs links)"`

---

## Task 5: Methodology inference (`methodology.py`)

**Files:** Create `src/gapscope/methodology.py`, `tests/test_methodology.py`.

Note: produces `kind="methodology"` GapItems. Uses an injected `llm` exposing `.parse(system=, user=, schema=)`. Clustering is exact normalized-string match across targets.

- [ ] **Step 1 — failing test** `tests/test_methodology.py`:

```python
from gapscope.methodology import MethodologyTags, infer_methodologies, cluster_methodologies
from gapscope.models import Baseline


class FakeLLM:
    """Returns canned tags keyed by a substring of the user prompt."""
    def __init__(self, mapping):
        self.mapping = mapping
        self.calls = 0

    def parse(self, *, system, user, schema):
        self.calls += 1
        for needle, tags in self.mapping.items():
            if needle in user:
                return schema(tags=tags)
        return schema(tags=[])


def test_infer_methodologies_calls_llm_per_readme():
    llm = FakeLLM({"repoA": ["mcp server", "rag"], "repoB": ["agent orchestration"]})
    readmes = [("alice/repoA", "alice", "uses an MCP server with repoA"),
               ("bob/repoB", "bob", "repoB agent loop")]
    tags = infer_methodologies(llm, readmes)
    assert llm.calls == 2
    # normalized (owner, tag) tuples
    assert ("alice", "mcp server") in tags
    assert ("bob", "agent orchestration") in tags


def test_cluster_counts_distinct_owners_and_filters_baseline():
    tagged = [("alice", "mcp"), ("bob", "mcp"), ("alice", "rag"), ("alice", "transfer learning")]
    baseline = Baseline(tools=[], methods=["transfer learning"])
    items = cluster_methodologies(tagged, baseline)
    by_id = {i.id: i for i in items}
    assert "transfer learning" not in by_id          # in baseline.methods -> excluded
    assert by_id["mcp"].frequency == 2               # alice + bob
    assert by_id["mcp"].kind == "methodology"
    assert by_id["rag"].frequency == 1
```

- [ ] **Step 2 — run, expect fail.**

- [ ] **Step 3 — implement** `src/gapscope/methodology.py`:

```python
from pydantic import BaseModel, Field

from .models import Baseline, GapItem


class MethodologyTags(BaseModel):
    """Open-ended methodology tags an LLM observed in a repo (NOT a fixed checklist)."""
    tags: list[str] = Field(default_factory=list)


_SYSTEM = (
    "You analyze a software repository's README. List the higher-level engineering "
    "methodologies and patterns it actually uses (e.g. 'mcp server', 'rag', "
    "'agent orchestration', 'event-driven'). Open-ended: name what you observe, do not "
    "match a fixed list. Lowercase short noun phrases. Empty list if none are evident."
)


def _normalize(tag: str) -> str:
    return " ".join(tag.lower().split())


def infer_methodologies(llm, readmes) -> list[tuple[str, str]]:
    """readmes: iterable of (full_name, owner, readme_text).
    Returns list of (owner, normalized_tag). One LLM call per README."""
    out: list[tuple[str, str]] = []
    for _full_name, owner, text in readmes:
        result = llm.parse(system=_SYSTEM, user=text, schema=MethodologyTags)
        for tag in result.tags:
            norm = _normalize(tag)
            if norm:
                out.append((owner, norm))
    return out


def cluster_methodologies(tagged: list[tuple[str, str]], baseline: Baseline) -> list[GapItem]:
    """Cluster (owner, tag) pairs into methodology GapItems by exact normalized match.
    frequency = distinct owners. Baseline methods excluded. recency/rank are neutral
    (1.0) here — methodologies carry no per-repo push date in v1."""
    base = {m.lower() for m in baseline.methods}
    agg: dict[str, set[str]] = {}
    for owner, tag in tagged:
        if tag in base:
            continue
        agg.setdefault(tag, set()).add(owner)
    if not agg:
        return []
    max_freq = max(len(o) for o in agg.values())
    items = []
    for tag, owners in agg.items():
        freq = len(owners)
        items.append(GapItem(
            id=tag, name=tag, kind="methodology",
            frequency=freq, recencyScore=1.0,
            rankScore=round(0.7 * (freq / max_freq) + 0.3 * 1.0, 4),
            evidence=[],
        ))
    items.sort(key=lambda g: (g.rankScore, g.frequency), reverse=True)
    return items
```

- [ ] **Step 4 — run, expect 2 passed.**

- [ ] **Step 5 — commit:** `git add -A && git commit -m "feat: LLM methodology inference + cross-target clustering"`

---

## Task 6: Resolver — research unknowns (`resolver.py`)

**Files:** Create `src/gapscope/resolver.py`, `tests/test_resolver.py`.

Scope for v1 (keep deterministic + testable): resolve a tool gap's identity from the **PyPI** JSON API (`https://pypi.org/pypi/{name}/json`) and synthesize a one-line summary via the injected `llm`. (npm/context7 are noted as follow-ons; PyPI covers the Python-tool case and proves the pattern.) Injected `http` (httpx) + `llm` for tests.

- [ ] **Step 1 — failing test** `tests/test_resolver.py`:

```python
import httpx
from gapscope.resolver import fetch_pypi_summary, ResearchCard, research_gap


def _client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_fetch_pypi_summary_extracts_description_and_home():
    def handler(request):
        assert request.url.path == "/pypi/langchain/json"
        return httpx.Response(200, json={"info": {"summary": "Build LLM apps",
                                                   "home_page": "https://langchain.com"}})
    out = fetch_pypi_summary("langchain", http=_client(handler))
    assert out["summary"] == "Build LLM apps"
    assert out["home_page"] == "https://langchain.com"


def test_fetch_pypi_summary_none_on_404():
    def handler(request):
        return httpx.Response(404)
    assert fetch_pypi_summary("nope", http=_client(handler)) is None


class FakeLLM:
    def parse(self, *, system, user, schema):
        return schema(summary="LangChain is a framework for building LLM applications.")


def test_research_gap_builds_card():
    def handler(request):
        return httpx.Response(200, json={"info": {"summary": "Build LLM apps",
                                                   "home_page": "https://langchain.com"}})
    card = research_gap("langchain", FakeLLM(), http=_client(handler))
    assert isinstance(card, ResearchCard)
    assert "LangChain" in card.summary
    assert card.researched is True
```

- [ ] **Step 2 — run, expect fail.**

- [ ] **Step 3 — implement** `src/gapscope/resolver.py`:

```python
import httpx
from pydantic import BaseModel

PYPI_BASE = "https://pypi.org"


class ResearchCard(BaseModel):
    summary: str
    researched: bool = True


class _Summary(BaseModel):
    summary: str


_SYSTEM = (
    "You explain an engineering tool to a developer deciding whether to learn it. "
    "Given registry metadata, write 1-2 plain sentences: what it is and the problem it "
    "solves. No marketing language."
)


def fetch_pypi_summary(name: str, http: httpx.Client | None = None) -> dict | None:
    own = http is None
    client = http or httpx.Client(base_url=PYPI_BASE, timeout=15.0)
    try:
        resp = client.get(f"/pypi/{name}/json")
        if resp.status_code != 200:
            return None
        info = resp.json().get("info", {})
        return {"summary": info.get("summary", ""), "home_page": info.get("home_page", "")}
    except httpx.HTTPError:
        return None
    finally:
        if own:
            client.close()


def research_gap(tool: str, llm, http: httpx.Client | None = None) -> ResearchCard:
    """Research one unknown tool: PyPI metadata -> LLM one-liner. Falls back to a
    minimal card if the registry has nothing (never raises)."""
    meta = fetch_pypi_summary(tool, http=http)
    if not meta or not meta.get("summary"):
        return ResearchCard(summary=f"{tool}: no registry description found.", researched=False)
    user = f"Tool: {tool}\nRegistry summary: {meta['summary']}\nHomepage: {meta.get('home_page','')}"
    result = llm.parse(system=_SYSTEM, user=user, schema=_Summary)
    return ResearchCard(summary=result.summary, researched=True)
```

- [ ] **Step 4 — run, expect 3 passed.**

- [ ] **Step 5 — commit:** `git add -A && git commit -m "feat: resolver researches unknown tools via PyPI + LLM"`

---

## Task 7: Recommender — verified docs + project ideas (`recommender.py`)

**Files:** Create `src/gapscope/recommender.py`, `config/docs_registry.yaml`, `tests/test_recommender.py`.

- [ ] **Step 1 — failing test** `tests/test_recommender.py`:

```python
from gapscope.recommender import load_docs_registry, pick_docs, ProjectIdeas, recommend_projects


def test_pick_docs_prefers_registry_and_verifies():
    registry = {"fastapi": "https://fastapi.tiangolo.com"}
    # verifier stub: registry URL good, fallback pypi URL good
    def verify(url):
        return True
    docs = pick_docs("fastapi", registry, verify=verify)
    assert docs == [{"title": "fastapi official docs", "url": "https://fastapi.tiangolo.com", "verified": True}]


def test_pick_docs_falls_back_to_pypi_when_not_in_registry():
    def verify(url):
        return True
    docs = pick_docs("langchain", {}, verify=verify)
    assert docs[0]["url"] == "https://pypi.org/project/langchain/"
    assert docs[0]["verified"] is True


def test_pick_docs_drops_dead_links():
    def verify(url):
        return False  # everything dead
    assert pick_docs("ghosttool", {}, verify=verify) == []


class FakeLLM:
    def parse(self, *, system, user, schema):
        return schema(small=["wrap a small API"], big=["build a full service"])


def test_recommend_projects_returns_small_and_big():
    out = recommend_projects("fastapi", "FastAPI is a web framework.", FakeLLM())
    assert out["small"] == ["wrap a small API"]
    assert out["big"] == ["build a full service"]
```

- [ ] **Step 2 — run, expect fail.**

- [ ] **Step 3 — implement** `src/gapscope/recommender.py`:

```python
from pathlib import Path
import yaml
from pydantic import BaseModel, Field

from .links import verify_url


class ProjectIdeas(BaseModel):
    small: list[str] = Field(default_factory=list)
    big: list[str] = Field(default_factory=list)


def load_docs_registry(path: str) -> dict:
    p = Path(path)
    return yaml.safe_load(p.read_text(encoding="utf-8")) if p.exists() else {}


def pick_docs(tool: str, registry: dict, verify=verify_url) -> list[dict]:
    """Curated registry first, then PyPI project page fallback. Every URL HTTP-checked;
    dead links dropped. Returns a list (possibly empty) of {title,url,verified}."""
    candidates = []
    if tool in registry:
        candidates.append(("%s official docs" % tool, registry[tool]))
    candidates.append(("%s on PyPI" % tool, f"https://pypi.org/project/{tool}/"))
    for title, url in candidates:
        if verify(url):
            return [{"title": title, "url": url, "verified": True}]
    return []


_SYSTEM = (
    "You suggest hands-on projects to learn an engineering tool. Given a short "
    "description, return 1-2 small starter projects and 1 larger project. Concrete, "
    "buildable, one line each."
)


def recommend_projects(tool: str, summary: str, llm) -> dict:
    result = llm.parse(
        system=_SYSTEM,
        user=f"Tool: {tool}\nDescription: {summary}",
        schema=ProjectIdeas,
    )
    return {"small": result.small, "big": result.big}
```

- [ ] **Step 4 — run, expect 4 passed.**

- [ ] **Step 5 — create** `config/docs_registry.yaml`:
```yaml
# Curated tool -> official docs URL. Deterministic, always correct for common tools.
fastapi: https://fastapi.tiangolo.com
langchain: https://python.langchain.com
docker: https://docs.docker.com
pytest: https://docs.pytest.org
ruff: https://docs.astral.sh/ruff/
pydantic: https://docs.pydantic.dev
```

- [ ] **Step 6 — commit:** `git add -A && git commit -m "feat: recommender with verified docs + LLM project ideas"`

---

## Task 8: CLI enrichment wiring + integration test

**Files:** Modify `src/gapscope/cli.py`. Create `tests/test_cli_enrich.py`.

Enrichment flow in `run_sweep` when `args.enrich`:
1. Require `ANTHROPIC_API_KEY` (error clearly if missing).
2. Build `LLMClient` from `config/llm.yaml`.
3. Methodology: fetch README (`client.get_file(owner, repo, "README.md")`) for up to 3 recent repos per target, infer + cluster, append methodology GapItems to `gaps`.
4. Research + recommend: for the top `args.research_top` gaps, attach `research`, `docs`, `projects`.
Re-rank combined gaps by `rankScore`.

- [ ] **Step 1 — failing test** `tests/test_cli_enrich.py`:

```python
import json
from gapscope import cli


class FakeClient:
    def __init__(self, repos, files):
        self._repos, self._files = repos, files
    def list_repos(self, u):
        return self._repos.get(u, [])
    def get_file(self, owner, repo, path):
        return self._files.get((repo, path))


def _repo(owner, name, pushed):
    return {"name": name, "full_name": f"{owner}/{name}", "owner": {"login": owner},
            "pushed_at": pushed, "fork": False, "archived": False}


class FakeLLM:
    def parse(self, *, system, user, schema):
        name = schema.__name__
        if name == "MethodologyTags":
            return schema(tags=["mcp server"] if "agent" in user else [])
        if name == "_Summary":
            return schema(summary="A tool for X.")
        if name == "ProjectIdeas":
            return schema(small=["s"], big=["b"])
        return schema()


def test_enrich_adds_methodology_and_recommendations(tmp_path, monkeypatch):
    repos = {
        "milanvarghese": [_repo("milanvarghese", "mine", "2026-01-01T00:00:00Z")],
        "alice": [_repo("alice", "agent", "2026-06-01T00:00:00Z")],
    }
    files = {
        ("mine", "requirements.txt"): "fastapi\n",
        ("agent", "requirements.txt"): "fastapi\nlangchain\n",
        ("agent", "README.md"): "this is an agent project",
    }
    monkeypatch.setattr(cli, "GitHubClient", lambda token=None: FakeClient(repos, files))
    monkeypatch.setattr(cli, "LLMClient", lambda **kw: FakeLLM())
    # resolver/recommender hit PyPI + verify; stub them deterministically
    monkeypatch.setattr(cli, "research_gap", lambda tool, llm, **kw: cli.ResearchCard(summary="A tool for X."))
    monkeypatch.setattr(cli, "pick_docs", lambda tool, registry, **kw: [{"title": f"{tool} docs", "url": "u", "verified": True}])
    monkeypatch.setattr(cli, "recommend_projects", lambda tool, summary, llm: {"small": ["s"], "big": ["b"]})
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")

    targets = tmp_path / "t.yaml"
    targets.write_text("you: milanvarghese\nroles:\n  ai-engineer:\n    - alice\n", encoding="utf-8")
    seed = tmp_path / "s.yaml"
    seed.write_text("tools: []\nmethods: []\n", encoding="utf-8")
    out = tmp_path / "data.json"

    rc = cli.main(["sweep", "--role", "ai-engineer", "--config", str(targets),
                   "--baseline-seed", str(seed), "--out", str(out), "--enrich", "--research-top", "5"])
    assert rc == 0
    data = json.loads(out.read_text(encoding="utf-8"))
    ids = [g["id"] for g in data["gaps"]]
    assert "langchain" in ids                 # tool gap
    assert "mcp server" in ids                 # methodology gap from README
    lc = next(g for g in data["gaps"] if g["id"] == "langchain")
    assert lc["docs"] and lc["docs"][0]["verified"] is True
    assert lc["projects"]["small"] == ["s"]


def test_enrich_requires_api_key(tmp_path, monkeypatch):
    monkeypatch.setattr(cli, "GitHubClient", lambda token=None: FakeClient({}, {}))
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    targets = tmp_path / "t.yaml"
    targets.write_text("you: me\nroles:\n  r:\n    - a\n", encoding="utf-8")
    seed = tmp_path / "s.yaml"
    seed.write_text("tools: []\nmethods: []\n", encoding="utf-8")
    rc = cli.main(["sweep", "--role", "r", "--config", str(targets),
                   "--baseline-seed", str(seed), "--out", str(tmp_path / "d.json"), "--enrich"])
    assert rc == 2   # clear failure, not a crash
```

- [ ] **Step 2 — run, expect fail.**

- [ ] **Step 3 — implement.** Read `src/gapscope/cli.py`. Add imports:
```python
from .llm import LLMClient, load_llm_config
from .methodology import infer_methodologies, cluster_methodologies
from .resolver import research_gap, ResearchCard
from .recommender import load_docs_registry, pick_docs, recommend_projects
```
Add a helper and the enrich branch. After `gaps = compute_gaps(target_repos, baseline, denoise_rules)` and before building the report, insert:

```python
    if args.enrich:
        if not os.environ.get("ANTHROPIC_API_KEY"):
            print("ERROR: --enrich requires ANTHROPIC_API_KEY", flush=True)
            return 2
        llm_cfg = load_llm_config("config/llm.yaml")
        llm = LLMClient(model=llm_cfg["model"], max_tokens=llm_cfg["max_tokens"])
        gaps = _enrich(gaps, target_repos, baseline, llm, client, args.research_top)
```

Add the `_enrich` function (module level):
```python
def _enrich(gaps, target_repos, baseline, llm, client, research_top):
    # 1. Methodologies from up to 3 recent repos per target
    seen_per_owner: dict[str, int] = {}
    readmes = []
    for repo in target_repos:
        if seen_per_owner.get(repo.owner, 0) >= 3:
            continue
        text = client.get_file(repo.owner, repo.full_name.split("/")[-1], "README.md")
        if text:
            readmes.append((repo.full_name, repo.owner, text))
            seen_per_owner[repo.owner] = seen_per_owner.get(repo.owner, 0) + 1
    tagged = infer_methodologies(llm, readmes)
    gaps = gaps + cluster_methodologies(tagged, baseline)
    gaps.sort(key=lambda g: (g.rankScore, g.frequency), reverse=True)

    # 2. Research + recommend top-N
    registry = load_docs_registry("config/docs_registry.yaml")
    for gap in gaps[:research_top]:
        if gap.kind == "tool":
            card = research_gap(gap.id, llm)
            gap.research = {"summary": card.summary, "researched": card.researched}
            gap.docs = pick_docs(gap.id, registry)
            gap.projects = recommend_projects(gap.id, card.summary, llm)
    return gaps
```

Note: `GapItem` has no `research` field yet — add it. In `src/gapscope/models.py`, add to `GapItem`: `research: dict = Field(default_factory=dict)`. (Keep all other fields.)

- [ ] **Step 4 — run** `tests/test_cli_enrich.py`, expect 2 passed.

- [ ] **Step 5 — run FULL suite, expect all green.**

- [ ] **Step 6 — commit:** `git add -A && git commit -m "feat: --enrich wires methodology + research + recommendations into sweep"`

---

## Self-Review

- Denoise (§1) free + always-on → Task 1. ✅
- LLM client + Haiku + injectable (§3) → Task 2. ✅
- Cache (§3) → Task 3. ✅
- Methodology inference + clustering (§2.1) → Task 5. ✅
- Resolver research (§2.2) → Task 6 (PyPI + LLM; npm/context7 = documented follow-on). ✅
- Recommender verified docs + projects (§2.3, §7 anti-hallucination) → Tasks 4 + 7. ✅
- `--enrich` gating + API-key check (§2, §5) → Task 8. ✅
- Data contract: `research` field added to GapItem; methodology items emitted. ✅
- All tests hermetic (fakes for LLM/GitHub, MockTransport for HTTP). Live `--enrich` smoke deferred to user's ANTHROPIC_API_KEY. ✅

**Documented v1 simplifications:** resolver covers PyPI (Python tools) — npm + context7 are follow-ons; methodology recency is neutral (1.0) since methodologies lack a per-repo push date; clustering is exact-match (synonym merging is a follow-on).
