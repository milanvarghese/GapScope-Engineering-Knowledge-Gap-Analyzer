from gapscope.methodology import MethodologyTags, infer_methodologies, cluster_methodologies
from gapscope.models import Baseline


class FakeLLM:
    """Returns canned tags keyed by a substring of the user prompt."""
    def __init__(self, mapping):
        self.mapping = mapping
        self.calls = 0

    def parse(self, *, system, user, schema):
        self.calls += 1
        for needle, tags in self.mapping.items():
            if needle in user:
                return schema(tags=tags)
        return schema(tags=[])


def test_infer_methodologies_calls_llm_per_readme():
    llm = FakeLLM({"repoA": ["mcp server", "rag"], "repoB": ["agent orchestration"]})
    readmes = [("alice/repoA", "alice", "uses an MCP server with repoA"),
               ("bob/repoB", "bob", "repoB agent loop")]
    tags = infer_methodologies(llm, readmes)
    assert llm.calls == 2
    # normalized (owner, tag) tuples
    assert ("alice", "mcp server") in tags
    assert ("bob", "agent orchestration") in tags


def test_cluster_counts_distinct_owners_and_filters_baseline():
    tagged = [("alice", "mcp"), ("bob", "mcp"), ("alice", "rag"), ("alice", "transfer learning")]
    baseline = Baseline(tools=[], methods=["transfer learning"])
    items = cluster_methodologies(tagged, baseline)
    by_id = {i.id: i for i in items}
    assert "transfer learning" not in by_id          # in baseline.methods -> excluded
    assert by_id["mcp"].frequency == 2               # alice + bob
    assert by_id["mcp"].kind == "methodology"
    assert by_id["rag"].frequency == 1
