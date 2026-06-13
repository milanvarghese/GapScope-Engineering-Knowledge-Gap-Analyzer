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
