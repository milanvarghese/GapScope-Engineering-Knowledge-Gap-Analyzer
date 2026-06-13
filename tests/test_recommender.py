from gapscope.recommender import load_docs_registry, pick_docs, ProjectIdeas, recommend_projects


def test_pick_docs_prefers_registry_and_verifies():
    registry = {"fastapi": "https://fastapi.tiangolo.com"}
    # verifier stub: registry URL good, fallback pypi URL good
    def verify(url):
        return True
    docs = pick_docs("fastapi", registry, verify=verify)
    assert docs == [{"title": "fastapi official docs", "url": "https://fastapi.tiangolo.com", "verified": True}]


def test_pick_docs_falls_back_to_pypi_when_not_in_registry():
    def verify(url):
        return True
    docs = pick_docs("langchain", {}, verify=verify)
    assert docs[0]["url"] == "https://pypi.org/project/langchain/"
    assert docs[0]["verified"] is True


def test_pick_docs_drops_dead_links():
    def verify(url):
        return False  # everything dead
    assert pick_docs("ghosttool", {}, verify=verify) == []


class FakeLLM:
    def parse(self, *, system, user, schema):
        return schema(small=["wrap a small API"], big=["build a full service"])


def test_recommend_projects_returns_small_and_big():
    out = recommend_projects("fastapi", "FastAPI is a web framework.", FakeLLM())
    assert out["small"] == ["wrap a small API"]
    assert out["big"] == ["build a full service"]
