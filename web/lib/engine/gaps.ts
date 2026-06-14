import type { Gap } from "../types";
import type { ExtractedRepo } from "./types";
import { applyDenoise, type DenoiseRules } from "./denoise";

export function round4(x: number): number {
  return Math.round(x * 1e4) / 1e4;
}

const FREQ_WEIGHT = 0.7;
const RECENCY_WEIGHT = 0.3;

type Accumulator = {
  owners: Set<string>;
  repos: string[];
  recent: Date;
};

export function computeGaps(
  targetRepos: ExtractedRepo[],
  baselineTools: string[],
  denoiseRules?: DenoiseRules,
): Gap[] {
  const base = new Set(baselineTools.map((t) => t.toLowerCase()));

  const agg = new Map<string, Accumulator>();

  for (const repo of targetRepos) {
    const tools = denoiseRules ? applyDenoise(repo.tools, denoiseRules) : repo.tools;
    for (const rawTool of tools) {
      const tool = rawTool.toLowerCase();
      if (base.has(tool)) continue;
      const existing = agg.get(tool);
      if (!existing) {
        agg.set(tool, { owners: new Set([repo.owner]), repos: [repo.fullName], recent: repo.pushedAt });
      } else {
        existing.owners.add(repo.owner);
        existing.repos.push(repo.fullName);
        if (repo.pushedAt > existing.recent) {
          existing.recent = repo.pushedAt;
        }
      }
    }
  }

  if (agg.size === 0) return [];

  const maxFreq = Math.max(...Array.from(agg.values()).map((e) => e.owners.size));

  const recents = Array.from(agg.values()).map((e) => e.recent.getTime());
  const minT = Math.min(...recents);
  const maxT = Math.max(...recents);
  const span = maxT - minT;

  const items: Gap[] = [];

  for (const [tool, entry] of agg) {
    const freq = entry.owners.size;
    const normFreq = freq / maxFreq;
    const normRecency = span === 0 ? 1.0 : (entry.recent.getTime() - minT) / span;
    const rankScore = round4(FREQ_WEIGHT * normFreq + RECENCY_WEIGHT * normRecency);
    const recencyScore = round4(normRecency);

    const uniqueRepos = Array.from(new Set(entry.repos)).sort();
    const evidence = uniqueRepos.slice(0, 5).map((repo) => ({ repo, signal: "dependency" as const }));

    items.push({
      id: tool,
      name: tool,
      kind: "tool",
      frequency: freq,
      recencyScore,
      rankScore,
      evidence,
      docs: [],
      projects: { small: [], big: [] },
      research: {},
    });
  }

  items.sort((a, b) => {
    if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
    return b.frequency - a.frequency;
  });

  return items;
}
