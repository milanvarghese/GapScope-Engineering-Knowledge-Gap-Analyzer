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
