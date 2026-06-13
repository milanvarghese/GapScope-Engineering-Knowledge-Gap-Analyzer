import httpx
from gapscope.resolver import fetch_pypi_summary, ResearchCard, research_gap


def _client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_fetch_pypi_summary_extracts_description_and_home():
    def handler(request):
        assert request.url.path == "/pypi/langchain/json"
        return httpx.Response(200, json={"info": {"summary": "Build LLM apps",
                                                   "home_page": "https://langchain.com"}})
    out = fetch_pypi_summary("langchain", http=_client(handler))
    assert out["summary"] == "Build LLM apps"
    assert out["home_page"] == "https://langchain.com"


def test_fetch_pypi_summary_none_on_404():
    def handler(request):
        return httpx.Response(404)
    assert fetch_pypi_summary("nope", http=_client(handler)) is None


class FakeLLM:
    def parse(self, *, system, user, schema):
        return schema(summary="LangChain is a framework for building LLM applications.")


def test_research_gap_builds_card():
    def handler(request):
        return httpx.Response(200, json={"info": {"summary": "Build LLM apps",
                                                   "home_page": "https://langchain.com"}})
    card = research_gap("langchain", FakeLLM(), http=_client(handler))
    assert isinstance(card, ResearchCard)
    assert "LangChain" in card.summary
    assert card.researched is True
