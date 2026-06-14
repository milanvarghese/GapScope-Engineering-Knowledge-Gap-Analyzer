import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { harvestUser, realGithub } from "@/lib/engine/github";
import { extractJSON } from "@/lib/engine/anthropic";
import { BOUNDS } from "@/lib/engine/config";
import { mapPool } from "@/lib/engine/concurrency";
import { analyzeToReport } from "./_helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const token = process.env.GITHUB_TOKEN;

  if (!apiKey || !token) {
    return Response.json(
      { error: "Server not configured (ANTHROPIC_API_KEY and GITHUB_TOKEN required)" },
      { status: 500 },
    );
  }

  try {
    const body = await req.json();
    const github = realGithub(token);
    const client = new Anthropic({ apiKey });

    const deps = {
      harvest: (u: string) =>
        harvestUser(github, u, { topN: BOUNDS.MAX_REPOS_PER_PERSON }),

      readmesFor: async (repos: Awaited<ReturnType<typeof harvestUser>>) => {
        const slice = repos.slice(0, BOUNDS.MAX_READMES);
        const results = await mapPool(slice, BOUNDS.CONCURRENCY, async (r) => {
          const repoName = r.fullName.split("/").pop()!;
          const text = await github.getFile(r.owner, repoName, "README.md");
          if (!text) return null;
          return [r.fullName, r.owner, text] as [string, string, string];
        });
        return results.filter((x): x is [string, string, string] => x !== null);
      },

      inferReadme: async (text: string): Promise<string[]> => {
        const result = await extractJSON(client, {
          system:
            "List the engineering methodologies/patterns this README's project uses (e.g. 'mcp server','rag','agent orchestration'). Open-ended; lowercase short noun phrases.",
          user: text,
          schema: z.object({ tags: z.array(z.string()) }),
        });
        return result.tags;
      },
    };

    const report = await analyzeToReport(deps, body);
    return Response.json(report);
  } catch (e: any) {
    return Response.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
