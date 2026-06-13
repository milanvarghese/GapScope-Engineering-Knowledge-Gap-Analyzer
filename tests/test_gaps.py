from datetime import datetime, timezone
from gapscope.gaps import compute_gaps
from gapscope.harvester import ExtractedRepo
from gapscope.models import Baseline


def _erepo(owner, name, tools, pushed):
    return ExtractedRepo(full_name=f"{owner}/{name}", owner=owner,
                         pushed_at=datetime.fromisoformat(pushed), tools=set(tools))


def test_baseline_tools_excluded():
    targets = [_erepo("alice", "x", {"fastapi", "langchain"}, "2026-06-01T00:00:00+00:00")]
    baseline = Baseline(tools=["fastapi"], methods=[])
    gaps = compute_gaps(targets, baseline)
    assert [g.id for g in gaps] == ["langchain"]


def test_frequency_counts_distinct_owners_and_ranks():
    # langchain: used by alice + bob (freq 2), most recent push 2026-06-10
    # mcp:       used by alice only      (freq 1), most recent push 2026-06-20 (newer)
    targets = [
        _erepo("alice", "r1", {"langchain"}, "2026-06-01T00:00:00+00:00"),
        _erepo("alice", "r2", {"mcp"}, "2026-06-20T00:00:00+00:00"),
        _erepo("bob", "r3", {"langchain"}, "2026-06-10T00:00:00+00:00"),
    ]
    gaps = compute_gaps(targets, Baseline(tools=[], methods=[]))
    by_id = {g.id: g for g in gaps}

    assert by_id["langchain"].frequency == 2
    assert by_id["mcp"].frequency == 1
    assert by_id["mcp"].recencyScore == 1.0
    assert by_id["langchain"].recencyScore == 0.0
    # rankScore = 0.7*norm_freq + 0.3*norm_recency
    # langchain: 0.7*(2/2) + 0.3*0.0 = 0.7 ; mcp: 0.7*(1/2) + 0.3*1.0 = 0.65
    assert by_id["langchain"].rankScore == 0.7
    assert by_id["mcp"].rankScore == 0.65
    # popular-but-older beats merely-recent now
    assert [g.id for g in gaps] == ["langchain", "mcp"]


def test_single_gap_recency_is_one():
    targets = [_erepo("alice", "r1", {"solo"}, "2026-06-01T00:00:00+00:00")]
    gaps = compute_gaps(targets, Baseline(tools=[], methods=[]))
    assert gaps[0].recencyScore == 1.0
    assert gaps[0].rankScore == 1.0


def test_evidence_dedup_and_capped():
    targets = [_erepo("alice", f"r{i}", {"tool"}, "2026-06-01T00:00:00+00:00") for i in range(7)]
    gaps = compute_gaps(targets, Baseline(tools=[], methods=[]))
    assert len(gaps[0].evidence) == 5
    assert all(e.signal == "dependency" for e in gaps[0].evidence)
