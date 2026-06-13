import httpx


def verify_url(url: str, http: httpx.Client | None = None) -> bool:
    """True if the URL resolves to a 2xx/3xx response. Network errors -> False.
    Never raises — a dead link must never ship as 'verified'."""
    own = http is None
    client = http or httpx.Client(timeout=10.0, follow_redirects=True)
    try:
        resp = client.get(url)
        return resp.status_code < 400
    except httpx.HTTPError:
        return False
    finally:
        if own:
            client.close()
