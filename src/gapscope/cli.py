import argparse
import os
from datetime import datetime, timezone

from .baseline import build_baseline
from .config import load_seed, load_targets
from .denoise import load_denoise_rules
from .gaps import compute_gaps
from .github_client import GitHubClient
from .harvester import harvest_user
from .report import build_report, write_report


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
