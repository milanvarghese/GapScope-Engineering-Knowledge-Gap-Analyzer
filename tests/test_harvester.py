from datetime import datetime, timezone
from gapscope.harvester import harvest_user, ExtractedRepo


class FakeClient:
    """In-memory stand-in for GitHubClient."""

    def __init__(self, repos, files):
        self._repos = repos          # dict: username -> list[repo dict]
        self._files = files          # dict: (repo_name, path) -> text or None

    def list_repos(self, username):
        return self._repos.get(username, [])

    def get_file(self, owner, repo, path):
        return self._files.get((repo, path))


def _repo(name, pushed, fork=False, archived=False):
    return {
        "name": name,
        "full_name": f"alice/{name}",
        "owner": {"login": "alice"},
        "pushed_at": pushed,
        "fork": fork,
        "archived": archived,
    }


def test_harvest_filters_and_extracts_recency_first():
    repos = {
        "alice": [
            _repo("fresh", "2026-06-01T00:00:00Z"),
            _repo("forked", "2026-05-20T00:00:00Z", fork=True),
            _repo("archived", "2026-05-19T00:00:00Z", archived=True),
            _repo("nomanifest", "2026-05-18T00:00:00Z"),
            _repo("older", "2026-04-01T00:00:00Z"),
        ]
    }
    files = {
        ("fresh", "requirements.txt"): "langchain\nfastapi\n",
        ("older", "package.json"): '{"dependencies": {"react": "^18"}}',
        # nomanifest, forked, archived: no files registered -> get_file returns None
    }
    out = harvest_user(FakeClient(repos, files), "alice", top_n=10)

    names = [r.full_name for r in out]
    assert names == ["alice/fresh", "alice/older"]            # fork/archived/no-manifest dropped
    assert out[0].tools == {"langchain", "fastapi"}
    assert out[1].tools == {"react"}
    assert out[0].pushed_at == datetime(2026, 6, 1, tzinfo=timezone.utc)


def test_harvest_respects_top_n():
    repos = {
        "alice": [
            _repo("a", "2026-06-03T00:00:00Z"),
            _repo("b", "2026-06-02T00:00:00Z"),
            _repo("c", "2026-06-01T00:00:00Z"),
        ]
    }
    files = {
        ("a", "requirements.txt"): "flask\n",
        ("b", "requirements.txt"): "django\n",
        ("c", "requirements.txt"): "fastapi\n",
    }
    out = harvest_user(FakeClient(repos, files), "alice", top_n=2)
    assert [r.full_name for r in out] == ["alice/a", "alice/b"]
