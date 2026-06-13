from dataclasses import dataclass, field
from datetime import datetime

from .manifests import parse_manifest, MANIFEST_NAMES


@dataclass
class ExtractedRepo:
    full_name: str
    owner: str
    pushed_at: datetime
    tools: set[str] = field(default_factory=set)


def _parse_dt(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def harvest_user(client, username: str, top_n: int = 10, manifest_names=MANIFEST_NAMES):
    """Select a user's recent, non-fork, non-archived repos that have a dependency
    manifest, newest first, up to top_n. Returns ExtractedRepo per kept repo.

    `client.list_repos` already returns repos sorted by pushed-desc (recency-first).
    """
    out: list[ExtractedRepo] = []
    for repo in client.list_repos(username):
        if repo.get("fork") or repo.get("archived"):
            continue
        owner = repo["owner"]["login"]
        name = repo["name"]
        tools: set[str] = set()
        for manifest in manifest_names:
            text = client.get_file(owner, name, manifest)
            if text:
                tools |= parse_manifest(manifest, text)
        if not tools:
            continue
        out.append(
            ExtractedRepo(
                full_name=repo["full_name"],
                owner=username,
                pushed_at=_parse_dt(repo["pushed_at"]),
                tools=tools,
            )
        )
        if len(out) >= top_n:
            break
    return out
