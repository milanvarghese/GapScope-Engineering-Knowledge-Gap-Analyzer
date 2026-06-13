from datetime import datetime

from .denoise import apply_denoise
from .models import Baseline, Evidence, GapItem

# Ranking weights: frequency (how many engineers use it) is the primary signal;
# recency boosts but must not zero out a popular-but-older tool. Additive, not
# multiplicative, precisely to avoid that zeroing.
FREQ_WEIGHT = 0.7
RECENCY_WEIGHT = 0.3


def compute_gaps(target_repos, baseline: Baseline, denoise_rules: dict | None = None) -> list[GapItem]:
    """Gap = tools in targets' repos that are not in the baseline.
    Ranked by FREQ_WEIGHT*normalize(frequency) + RECENCY_WEIGHT*normalize(recency)."""
    base = set(baseline.tools)

    agg: dict[str, dict] = {}
    for repo in target_repos:
        tools = apply_denoise(repo.tools, denoise_rules) if denoise_rules else repo.tools
        for tool in tools:
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
        rank = round(FREQ_WEIGHT * norm_freq + RECENCY_WEIGHT * norm_recency, 4)
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
