import httpx
from pydantic import BaseModel

PYPI_BASE = "https://pypi.org"


class ResearchCard(BaseModel):
    summary: str
    researched: bool = True


class _Summary(BaseModel):
    summary: str


_SYSTEM = (
    "You explain an engineering tool to a developer deciding whether to learn it. "
    "Given registry metadata, write 1-2 plain sentences: what it is and the problem it "
    "solves. No marketing language."
)


def fetch_pypi_summary(name: str, http: httpx.Client | None = None) -> dict | None:
    own = http is None
    client = http or httpx.Client(timeout=15.0)
    url = f"{PYPI_BASE}/pypi/{name}/json"
    try:
        resp = client.get(url)
        if resp.status_code != 200:
            return None
        info = resp.json().get("info", {})
        return {"summary": info.get("summary", ""), "home_page": info.get("home_page", "")}
    except httpx.HTTPError:
        return None
    finally:
        if own:
            client.close()


def research_gap(tool: str, llm, http: httpx.Client | None = None) -> ResearchCard:
    """Research one unknown tool: PyPI metadata -> LLM one-liner. Falls back to a
    minimal card if the registry has nothing (never raises)."""
    meta = fetch_pypi_summary(tool, http=http)
    if not meta or not meta.get("summary"):
        return ResearchCard(summary=f"{tool}: no registry description found.", researched=False)
    user = f"Tool: {tool}\nRegistry summary: {meta['summary']}\nHomepage: {meta.get('home_page','')}"
    result = llm.parse(system=_SYSTEM, user=user, schema=_Summary)
    return ResearchCard(summary=result.summary, researched=True)
