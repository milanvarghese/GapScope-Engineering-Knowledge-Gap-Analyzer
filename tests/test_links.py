import httpx
from gapscope.links import verify_url


def _client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_verify_url_true_on_200():
    def handler(request):
        return httpx.Response(200)
    assert verify_url("https://example.com/docs", http=_client(handler)) is True


def test_verify_url_false_on_404():
    def handler(request):
        return httpx.Response(404)
    assert verify_url("https://example.com/missing", http=_client(handler)) is False


def test_verify_url_false_on_connection_error():
    def handler(request):
        raise httpx.ConnectError("boom")
    assert verify_url("https://nope.invalid", http=_client(handler)) is False
