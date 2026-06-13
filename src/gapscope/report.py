import json
from pathlib import Path

from .models import Baseline, GapItem, GapReport, Meta


def build_report(role: str, baseline: Baseline, gaps: list[GapItem],
                 targets_analyzed: int, generated_at: str) -> GapReport:
    return GapReport(
        meta=Meta(generatedAt=generated_at, role=role, targetsAnalyzed=targets_analyzed),
        baseline=baseline,
        gaps=gaps,
    )


def write_report(report: GapReport, path: str) -> None:
    Path(path).write_text(json.dumps(report.model_dump(), indent=2), encoding="utf-8")
