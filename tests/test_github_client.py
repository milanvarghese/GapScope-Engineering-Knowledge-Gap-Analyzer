import base64
import httpx
from gapscope.github_client import GitHubClient


def _make_client(handler):
    http = httpx.Client(base_url="https://api.github.com", transport=httpx.MockTransport(handler))
    return GitHubClient(http=http)


def test_list_repos_sends_recency_params_and_returns_json():
    captured = {}

    def handler(request):
        captured["path"] = request.url.path
        captured["query"] = dict(request.url.params)
        return httpx.Response(200, json=[{"name": "r1"}])

    client = _make_client(handler)
    repos = client.list_repos("alice")
    assert repos == [{"name": "r1"}]
    assert captured["path"] == "/users/alice/repos"
    assert captured["query"]["sort"] == "pushed"
    assert captured["query"]["direction"] == "desc"


def test_get_file_decodes_base64():
    content = base64.b64encode(b"flask\n").decode()

    def handler(request):
        return httpx.Response(200, json={"content": content, "encoding": "base64"})

    client = _make_client(handler)
    assert client.get_file("alice", "r1", "requirements.txt") == "flask\n"


def test_get_file_returns_none_on_404():
    def handler(request):
        return httpx.Response(404, json={"message": "Not Found"})

    client = _make_client(handler)
    assert client.get_file("alice", "r1", "requirements.txt") is None
