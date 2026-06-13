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
