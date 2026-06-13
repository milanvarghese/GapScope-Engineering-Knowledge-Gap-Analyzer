from pathlib import Path
import yaml


class LLMClient:
    """Thin wrapper over the Anthropic SDK. Inject `client` for tests.
    Uses messages.parse() for schema-validated structured output."""

    def __init__(self, model: str = "claude-haiku-4-5", max_tokens: int = 1024, client=None):
        self.model = model
        self.max_tokens = max_tokens
        if client is not None:
            self._client = client
        else:
            import anthropic  # imported lazily so tests need no SDK/key
            self._client = anthropic.Anthropic()

    def parse(self, *, system: str, user: str, schema):
        resp = self._client.messages.parse(
            model=self.model,
            max_tokens=self.max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
            output_format=schema,
        )
        return resp.parsed_output


def load_llm_config(path: str) -> dict:
    p = Path(path)
    data = yaml.safe_load(p.read_text(encoding="utf-8")) if p.exists() else {}
    data = data or {}
    data.setdefault("model", "claude-haiku-4-5")
    data.setdefault("max_tokens", 1024)
    return data
