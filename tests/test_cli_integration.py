import json
from gapscope import cli


class FakeClient:
    def __init__(self, repos, files):
        self._repos, self._files = repos, files

    def list_repos(self, username):
        return self._repos.get(username, [])

    def get_file(self, owner, repo, path):
        return self._files.get((repo, path))


def _repo(owner, name, pushed):
    return {"name": name, "full_name": f"{owner}/{name}", "owner": {"login": owner},
            "pushed_at": pushed, "fork": False, "archived": False}


def test_run_sweep_end_to_end(tmp_path, monkeypatch):
    repos = {
        "milanvarghese": [_repo("milanvarghese", "mine", "2026-01-01T00:00:00Z")],
        "alice": [_repo("alice", "agent", "2026-06-01T00:00:00Z")],
    }
    files = {
        ("mine", "requirements.txt"): "fastapi\n",          # baseline knows fastapi
        ("agent", "requirements.txt"): "fastapi\nlangchain\n",  # gap = langchain
    }
    fake = FakeClient(repos, files)
    monkeypatch.setattr(cli, "GitHubClient", lambda token=None: fake)

    targets = tmp_path / "targets.yaml"
    targets.write_text("you: milanvarghese\nroles:\n  ai-engineer:\n    - alice\n", encoding="utf-8")
    seed = tmp_path / "seed.yaml"
    seed.write_text("tools: []\nmethods: []\n", encoding="utf-8")
    out = tmp_path / "data.json"

    rc = cli.main([
        "sweep", "--role", "ai-engineer",
        "--config", str(targets), "--baseline-seed", str(seed),
        "--out", str(out), "--top-n", "10",
    ])
    assert rc == 0

    data = json.loads(out.read_text(encoding="utf-8"))
    assert "fastapi" in data["baseline"]["tools"]
    assert [g["id"] for g in data["gaps"]] == ["langchain"]   # fastapi filtered by baseline
    assert data["meta"]["role"] == "ai-engineer"
    assert data["meta"]["targetsAnalyzed"] == 1
