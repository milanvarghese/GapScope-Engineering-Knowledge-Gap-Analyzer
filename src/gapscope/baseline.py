from .models import Baseline


def build_baseline(own_repos, seed: dict) -> Baseline:
    """Merge tools extracted from the user's own repos with the manual seed list.
    Everything lowercased + sorted so gap subtraction is case-insensitive."""
    tools = {t.lower() for t in seed.get("tools", [])}
    for repo in own_repos:
        tools |= {t.lower() for t in repo.tools}
    methods = {m.lower() for m in seed.get("methods", [])}
    return Baseline(tools=sorted(tools), methods=sorted(methods))
