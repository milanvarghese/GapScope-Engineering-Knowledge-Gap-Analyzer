import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { harvestUser, realGithub } from "@/lib/engine/github";
import { extractJSON } from "@/lib/engine/anthropic";
import { BOUNDS } from "@/lib/engine/config";
import { runAnalysis } from "./_helpers";

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

  const body = await req.json();
  const github = realGithub(token);

  const deps = {
    harvest: (u: string) =>
      harvestUser(github, u, { topN: BOUNDS.MAX_REPOS_PER_PERSON }),

    readmesFor: async (repos: Awaited<ReturnType<typeof harvestUser>>) => {
      const out: [string, string, string][] = [];
      for (const r of repos) {
        const repoName = r.fullName.split("/").pop()!;
        const text = await github.getFile(r.owner, repoName, "README.md");
        if (text) out.push([r.fullName, r.owner, text]);
      }
      return out;
    },

    inferReadme: async (text: string): Promise<string[]> => {
      const client = new Anthropic({ apiKey });
      const result = await extractJSON(client, {
        system:
          "List the engineering methodologies/patterns this README's project uses (e.g. 'mcp server','rag','agent orchestration'). Open-ended; lowercase short noun phrases.",
        user: text,
        schema: z.object({ tags: z.array(z.string()) }),
      });
      return result.tags;
    },
  };

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const e of runAnalysis(deps, body)) {
          controller.enqueue(enc.encode("data: " + JSON.stringify(e) + "\n\n"));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
