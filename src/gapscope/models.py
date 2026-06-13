from typing import Literal
from pydantic import BaseModel, Field


class Evidence(BaseModel):
    repo: str
    signal: str


class GapItem(BaseModel):
    id: str
    name: str
    kind: Literal["tool", "methodology"] = "tool"
    frequency: int
    recencyScore: float
    rankScore: float
    evidence: list[Evidence] = Field(default_factory=list)
    research: dict = Field(default_factory=dict)
    docs: list[dict] = Field(default_factory=list)
    projects: dict = Field(default_factory=lambda: {"small": [], "big": []})


class Baseline(BaseModel):
    tools: list[str] = Field(default_factory=list)
    methods: list[str] = Field(default_factory=list)


class Meta(BaseModel):
    generatedAt: str
    role: str
    targetsAnalyzed: int


class GapReport(BaseModel):
    meta: Meta
    baseline: Baseline
    gaps: list[GapItem] = Field(default_factory=list)
