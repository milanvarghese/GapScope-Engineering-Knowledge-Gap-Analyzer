import json
from gapscope import cli


class FakeClient:
    def __init__(self, repos, files):
        self._repos, self._files = repos, files
    def list_repos(self, u):
        return self._repos.get(u, [])
    def get_file(self, owner, repo, path):
        return self._files.get((repo, path))


def _repo(owner, name, pushed):
    return {"name": name, "full_name": f"{owner}/{name}", "owner": {"login": owner},
            "pushed_at": pushed, "fork": False, "archived": False}


class FakeLLM:
    def parse(self, *, system, user, schema):
        name = schema.__name__
        if name == "MethodologyTags":
            return schema(tags=["mcp server"] if "agent" in user else [])
        if name == "_Summary":
            return schema(summary="A tool for X.")
        if name == "ProjectIdeas":
            return schema(small=["s"], big=["b"])
        return schema()


def test_enrich_adds_methodology_and_recommendations(tmp_path, monkeypatch):
    repos = {
        "milanvarghese": [_repo("milanvarghese", "mine", "2026-01-01T00:00:00Z")],
        "alice": [_repo("alice", "agent", "2026-06-01T00:00:00Z")],
    }
    files = {
        ("mine", "requirements.txt"): "fastapi\n",
        ("agent", "requirements.txt"): "fastapi\nlangchain\n",
        ("agent", "README.md"): "this is an agent project",
    }
    monkeypatch.setattr(cli, "GitHubClient", lambda token=None: FakeClient(repos, files))
    monkeypatch.setattr(cli, "LLMClient", lambda **kw: FakeLLM())
    # resolver/recommender hit PyPI + verify; stub them deterministically
    monkeypatch.setattr(cli, "research_gap", lambda tool, llm, **kw: cli.ResearchCard(summary="A tool for X."))
    monkeypatch.setattr(cli, "pick_docs", lambda tool, registry, **kw: [{"title": f"{tool} docs", "url": "u", "verified": True}])
    monkeypatch.setattr(cli, "recommend_projects", lambda tool, summary, llm: {"small": ["s"], "big": ["b"]})
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")

    targets = tmp_path / "t.yaml"
    targets.write_text("you: milanvarghese\nroles:\n  ai-engineer:\n    - alice\n", encoding="utf-8")
    seed = tmp_path / "s.yaml"
    seed.write_text("tools: []\nmethods: []\n", encoding="utf-8")
    out = tmp_path / "data.json"

    rc = cli.main(["sweep", "--role", "ai-engineer", "--config", str(targets),
                   "--baseline-seed", str(seed), "--out", str(out), "--enrich", "--research-top", "5"])
    assert rc == 0
    data = json.loads(out.read_text(encoding="utf-8"))
    ids = [g["id"] for g in data["gaps"]]
    assert "langchain" in ids                 # tool gap
    assert "mcp server" in ids                 # methodology gap from README
    lc = next(g for g in data["gaps"] if g["id"] == "langchain")
    assert lc["docs"] and lc["docs"][0]["verified"] is True
    assert lc["projects"]["small"] == ["s"]


def test_enrich_requires_api_key(tmp_path, monkeypatch):
    monkeypatch.setattr(cli, "GitHubClient", lambda token=None: FakeClient({}, {}))
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    targets = tmp_path / "t.yaml"
    targets.write_text("you: me\nroles:\n  r:\n    - a\n", encoding="utf-8")
    seed = tmp_path / "s.yaml"
    seed.write_text("tools: []\nmethods: []\n", encoding="utf-8")
    rc = cli.main(["sweep", "--role", "r", "--config", str(targets),
                   "--baseline-seed", str(seed), "--out", str(tmp_path / "d.json"), "--enrich"])
    assert rc == 2   # clear failure, not a crash
