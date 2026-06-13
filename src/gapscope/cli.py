import argparse
import os
from datetime import datetime, timezone

from .baseline import build_baseline
from .config import load_seed, load_targets
from .denoise import load_denoise_rules
from .gaps import compute_gaps
from .github_client import GitHubClient
from .harvester import harvest_user
from .llm import LLMClient, load_llm_config
from .methodology import infer_methodologies, cluster_methodologies
from .recommender import load_docs_registry, pick_docs, recommend_projects
from .report import build_report, write_report
from .resolver import research_gap, ResearchCard


def _enrich(gaps, target_repos, baseline, llm, client, research_top):
    # 1. Methodologies from up to 3 recent repos per target
    seen_per_owner: dict[str, int] = {}
    readmes = []
    for repo in target_repos:
        if seen_per_owner.get(repo.owner, 0) >= 3:
            continue
        text = client.get_file(repo.owner, repo.full_name.split("/")[-1], "README.md")
        if text:
            readmes.append((repo.full_name, repo.owner, text))
            seen_per_owner[repo.owner] = seen_per_owner.get(repo.owner, 0) + 1
    tagged = infer_methodologies(llm, readmes)
    gaps = gaps + cluster_methodologies(tagged, baseline)
    gaps.sort(key=lambda g: (g.rankScore, g.frequency), reverse=True)

    # 2. Research + recommend top-N
    registry = load_docs_registry("config/docs_registry.yaml")
    for gap in gaps[:research_top]:
        if gap.kind == "tool":
            card = research_gap(gap.id, llm)
            gap.research = {"summary": card.summary, "researched": card.researched}
            gap.docs = pick_docs(gap.id, registry)
            gap.projects = recommend_projects(gap.id, card.summary, llm)
    return gaps


def run_sweep(args) -> int:
    cfg = load_targets(args.config)
    seed = load_seed(args.baseline_seed)

    client = GitHubClient(token=os.environ.get("GITHUB_TOKEN"))

    own = harvest_user(client, cfg["you"], top_n=args.top_n)
    baseline = build_baseline(own, seed)

    usernames = cfg["roles"][args.role]
    target_repos = []
    for user in usernames:
        try:
            target_repos.extend(harvest_user(client, user, top_n=args.top_n))
        except Exception as exc:  # one bad target must not abort the whole sweep
            print(f"  ! skipped {user}: {exc}")

    denoise_rules = load_denoise_rules("config/tool_denylist.yaml", "config/tool_groups.yaml")
    gaps = compute_gaps(target_repos, baseline, denoise_rules)

    if args.enrich:
        if not os.environ.get("ANTHROPIC_API_KEY"):
            print("ERROR: --enrich requires ANTHROPIC_API_KEY", flush=True)
            return 2
        llm_cfg = load_llm_config("config/llm.yaml")
        llm = LLMClient(model=llm_cfg["model"], max_tokens=llm_cfg["max_tokens"])
        gaps = _enrich(gaps, target_repos, baseline, llm, client, args.research_top)

    analyzed = len({r.owner for r in target_repos})
    generated_at = datetime.now(timezone.utc).isoformat()
    report = build_report(args.role, baseline, gaps, analyzed, generated_at)
    write_report(report, args.out)

    print(f"Wrote {args.out}: {len(gaps)} gaps from {len(usernames)} targets (role={args.role})")
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="gapscope")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sweep = sub.add_parser("sweep", help="Run a gap sweep and write data.json")
    sweep.add_argument("--role", required=True, help="Role key from targets.yaml")
    sweep.add_argument("--config", default="config/targets.yaml")
    sweep.add_argument("--baseline-seed", default="config/baseline_seed.yaml")
    sweep.add_argument("--out", default="data.json")
    sweep.add_argument("--top-n", type=int, default=10)
    sweep.add_argument("--enrich", action="store_true", help="LLM enrichment (needs ANTHROPIC_API_KEY)")
    sweep.add_argument("--research-top", type=int, default=15)

    args = parser.parse_args(argv)
    if args.cmd == "sweep":
        return run_sweep(args)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
