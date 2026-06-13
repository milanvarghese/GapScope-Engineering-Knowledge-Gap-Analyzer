import json
from gapscope.models import Evidence, GapItem, Baseline, Meta, GapReport
from gapscope.report import build_report, write_report


def test_gapitem_defaults_and_dump():
    item = GapItem(
        id="langchain",
        name="langchain",
        frequency=3,
        recencyScore=0.5,
        rankScore=0.25,
        evidence=[Evidence(repo="a/b", signal="dependency")],
    )
    dumped = item.model_dump()
    assert dumped["kind"] == "tool"
    assert dumped["docs"] == []
    assert dumped["projects"] == {"small": [], "big": []}
    assert dumped["evidence"][0] == {"repo": "a/b", "signal": "dependency"}


def test_gapreport_dump_shape():
    report = GapReport(
        meta=Meta(generatedAt="2026-06-13T00:00:00+00:00", role="ai-engineer", targetsAnalyzed=2),
        baseline=Baseline(tools=["fastapi"], methods=[]),
        gaps=[],
    )
    dumped = report.model_dump()
    assert set(dumped.keys()) == {"meta", "baseline", "gaps"}
    assert dumped["meta"]["targetsAnalyzed"] == 2


def test_build_and_write_report(tmp_path):
    baseline = Baseline(tools=["fastapi"], methods=[])
    gaps = [GapItem(id="langchain", name="langchain", frequency=2, recencyScore=1.0, rankScore=1.0,
                    evidence=[Evidence(repo="a/b", signal="dependency")])]
    report = build_report("ai-engineer", baseline, gaps, targets_analyzed=3,
                          generated_at="2026-06-13T00:00:00+00:00")
    assert report.meta.role == "ai-engineer"
    assert report.meta.targetsAnalyzed == 3

    out = tmp_path / "data.json"
    write_report(report, str(out))
    loaded = json.loads(out.read_text(encoding="utf-8"))
    assert loaded["gaps"][0]["id"] == "langchain"
    assert loaded["meta"]["generatedAt"] == "2026-06-13T00:00:00+00:00"
