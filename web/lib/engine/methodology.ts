import type { Gap } from "../types";
import { round4 } from "./gaps";
import { mapPool } from "./concurrency";

export async function inferMethodologies(
  infer: (text: string) => Promise<string[]>,
  readmes: [string, string, string][],
): Promise<[string, string][]> {
  // Run infer calls concurrently (limit 5), preserving input order.
  const perReadme = await mapPool(readmes, 5, async ([_fullName, owner, text]) => {
    let tags: string[];
    try {
      tags = await infer(text);
    } catch {
      return [] as [string, string][];
    }
    return tags
      .map((tag) => tag.toLowerCase().split(/\s+/).join(" "))
      .filter(Boolean)
      .map((norm): [string, string] => [owner, norm]);
  });
  return perReadme.flat();
}

export function clusterMethodologies(
  tagged: [string, string][],
  baselineMethods: string[],
): Gap[] {
  const base = new Set(baselineMethods.map((m) => m.toLowerCase()));
  const agg = new Map<string, Set<string>>();

  for (const [owner, tag] of tagged) {
    if (base.has(tag)) continue;
    const owners = agg.get(tag) ?? new Set<string>();
    owners.add(owner);
    agg.set(tag, owners);
  }

  if (agg.size === 0) return [];

  const maxFreq = Math.max(...Array.from(agg.values()).map((o) => o.size));

  const items: Gap[] = [];
  for (const [tag, owners] of agg) {
    const freq = owners.size;
    items.push({
      id: tag,
      name: tag,
      kind: "methodology",
      frequency: freq,
      recencyScore: 1.0,
      rankScore: round4(0.7 * (freq / maxFreq) + 0.3),
      evidence: [],
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
