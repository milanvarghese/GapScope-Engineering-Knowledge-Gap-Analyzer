import type { Gap } from "../types";
import { round4 } from "./gaps";

export async function inferMethodologies(
  infer: (text: string) => Promise<string[]>,
  readmes: [string, string, string][],
): Promise<[string, string][]> {
  const out: [string, string][] = [];
  for (const [_fullName, owner, text] of readmes) {
    const tags = await infer(text);
    for (const tag of tags) {
      const norm = tag.toLowerCase().split(/\s+/).join(" ");
      if (norm) out.push([owner, norm]);
    }
  }
  return out;
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
