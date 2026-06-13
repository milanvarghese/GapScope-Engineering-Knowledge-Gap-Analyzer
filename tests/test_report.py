from gapscope.models import Evidence, GapItem, Baseline, Meta, GapReport


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
