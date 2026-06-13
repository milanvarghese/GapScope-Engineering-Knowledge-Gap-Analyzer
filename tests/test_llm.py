from pydantic import BaseModel
from gapscope.llm import LLMClient, load_llm_config


class _Out(BaseModel):
    answer: str


class FakeMessages:
    def __init__(self, recorder):
        self._recorder = recorder

    def parse(self, *, model, max_tokens, system, messages, output_format):
        self._recorder["model"] = model
        self._recorder["system"] = system

        class _Resp:
            parsed_output = output_format(answer="ok")
        return _Resp()


class FakeAnthropic:
    def __init__(self):
        self.recorder = {}
        self.messages = FakeMessages(self.recorder)


def test_llm_parse_returns_validated_model():
    fake = FakeAnthropic()
    llm = LLMClient(model="claude-haiku-4-5", client=fake)
    out = llm.parse(system="sys", user="hi", schema=_Out)
    assert isinstance(out, _Out)
    assert out.answer == "ok"
    assert fake.recorder["model"] == "claude-haiku-4-5"
    assert fake.recorder["system"] == "sys"


def test_load_llm_config_default(tmp_path):
    p = tmp_path / "llm.yaml"
    p.write_text("model: claude-haiku-4-5\nmax_tokens: 1024\n", encoding="utf-8")
    cfg = load_llm_config(str(p))
    assert cfg["model"] == "claude-haiku-4-5"
    assert cfg["max_tokens"] == 1024
