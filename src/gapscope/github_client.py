import base64
import httpx

API_BASE = "https://api.github.com"


class GitHubClient:
    """Thin wrapper over the GitHub REST API. HTTP only — no parsing logic."""

    def __init__(self, token: str | None = None, http: httpx.Client | None = None):
        if http is not None:
            self._http = http
        else:
            headers = {"Accept": "application/vnd.github+json"}
            if token:
                headers["Authorization"] = f"Bearer {token}"
            self._http = httpx.Client(base_url=API_BASE, headers=headers, timeout=30.0)

    def list_repos(self, username: str) -> list[dict]:
        # Single page of up to 100 repos. Combined with sort=pushed (newest first)
        # and the caller's top_n cap, the most-recent repos are always covered;
        # users with >100 repos lose only the long-tail oldest ones (acceptable).
        resp = self._http.get(
            f"/users/{username}/repos",
            params={"sort": "pushed", "direction": "desc", "per_page": 100},
        )
        resp.raise_for_status()
        return resp.json()

    def get_file(self, owner: str, repo: str, path: str) -> str | None:
        resp = self._http.get(f"/repos/{owner}/{repo}/contents/{path}")
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        data = resp.json()
        return base64.b64decode(data["content"]).decode("utf-8", errors="replace")
