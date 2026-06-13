from datetime import datetime, timezone

from gapscope.config import load_targets, load_seed
from gapscope.baseline import build_baseline
from gapscope.harvester import ExtractedRepo


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


def _erepo(name, tools):
    return ExtractedRepo(full_name=f"milanvarghese/{name}", owner="milanvarghese",
                         pushed_at=datetime(2026, 1, 1, tzinfo=timezone.utc), tools=set(tools))


def test_build_baseline_merges_repos_and_seed_lowercased_sorted():
    own = [_erepo("a", {"FastAPI", "httpx"}), _erepo("b", {"pytest"})]
    seed = {"tools": ["Docker", "fastapi"], "methods": ["Transfer-Learning"]}
    baseline = build_baseline(own, seed)
    assert baseline.tools == ["docker", "fastapi", "httpx", "pytest"]
    assert baseline.methods == ["transfer-learning"]
