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
