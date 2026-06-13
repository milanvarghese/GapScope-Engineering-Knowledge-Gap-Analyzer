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
