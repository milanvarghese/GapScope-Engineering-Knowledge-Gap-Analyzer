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
