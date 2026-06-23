import { parseManifest, isDependencyDump, MANIFEST_NAMES } from "./manifests";
import { mapPool } from "./concurrency";
import type { ExtractedRepo } from "./types";

const API = "https://api.github.com";

export type GithubDeps = {
  listRepos: (username: string) => Promise<any[]>;
  getFile: (owner: string, repo: string, path: string) => Promise<string | null>;
};

export function realGithub(token?: string): GithubDeps {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return {
    async listRepos(username) {
      const r = await fetch(`${API}/users/${username}/repos?sort=pushed&direction=desc&per_page=100`, { headers });
      if (!r.ok) throw new Error(`${r.status} listing ${username}`);
      return r.json();
    },
    async getFile(owner, repo, path) {
      const r = await fetch(`${API}/repos/${owner}/${repo}/contents/${path}`, { headers });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`${r.status} fetching ${repo}/${path}`);
      const data = await r.json();
      return Buffer.from(data.content, "base64").toString("utf-8");
    },
  };
}

export async function harvestUser(
  deps: GithubDeps,
  username: string,
  opts: { topN?: number; maxProbe?: number; manifests?: string[] } = {},
): Promise<ExtractedRepo[]> {
  const topN = opts.topN ?? 5;
  const maxProbe = opts.maxProbe ?? 8;
  const manifests = opts.manifests ?? MANIFEST_NAMES;

  const allRepos = await deps.listRepos(username);
  const candidates = allRepos.filter((r) => !r.fork && !r.archived).slice(0, maxProbe);

  const probed = await mapPool(candidates, 8, async (repo) => {
    const texts = await mapPool(manifests, 3, (m) =>
      deps.getFile(repo.owner.login, repo.name, m),
    );
    const tools = new Set<string>();
    for (let i = 0; i < manifests.length; i++) {
      const text = texts[i];
      if (text && !isDependencyDump(manifests[i], text)) {
        for (const t of parseManifest(manifests[i], text)) tools.add(t);
      }
    }
    return tools.size > 0 ? { repo, tools } : null;
  });

  return probed
    .filter((x): x is { repo: any; tools: Set<string> } => x !== null)
    .slice(0, topN)
    .map(({ repo, tools }) => ({
      fullName: repo.full_name,
      owner: username,
      pushedAt: new Date(repo.pushed_at),
      tools,
      description: repo.description ?? "",
      topics: repo.topics ?? [],
    }));
}
