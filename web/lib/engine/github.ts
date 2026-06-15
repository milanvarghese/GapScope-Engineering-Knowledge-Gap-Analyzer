import { parseManifest, isDependencyDump, MANIFEST_NAMES } from "./manifests";
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
  opts: { topN?: number; manifests?: string[] } = {},
): Promise<ExtractedRepo[]> {
  const topN = opts.topN ?? 5;
  const manifests = opts.manifests ?? MANIFEST_NAMES;
  const out: ExtractedRepo[] = [];
  for (const repo of await deps.listRepos(username)) {
    if (repo.fork || repo.archived) continue;
    const tools = new Set<string>();
    for (const m of manifests) {
      const text = await deps.getFile(repo.owner.login, repo.name, m);
      if (text && !isDependencyDump(m, text)) for (const t of parseManifest(m, text)) tools.add(t);
    }
    if (tools.size === 0) continue;
    out.push({ fullName: repo.full_name, owner: username, pushedAt: new Date(repo.pushed_at), tools, description: repo.description ?? "", topics: repo.topics ?? [] });
    if (out.length >= topN) break;
  }
  return out;
}
