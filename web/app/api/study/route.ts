import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { extractJSON } from "@/lib/engine/anthropic";
import { study } from "./_helpers";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  const tool = new URL(req.url).searchParams.get("tool");
  if (!tool) {
    return Response.json({ error: "Missing required query param: tool" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Server not configured (ANTHROPIC_API_KEY)" }, { status: 500 });
  }

  const client = new Anthropic({ apiKey });

  const deps = {
    pypiSummary: async (name: string): Promise<string | null> => {
      try {
        const r = await fetch(`https://pypi.org/pypi/${name}/json`);
        if (!r.ok) return null;
        const d = await r.json();
        return d.info?.summary ?? null;
      } catch {
        return null;
      }
    },

    summarize: async (t: string, meta: string): Promise<string> =>
      (
        await extractJSON(client, {
          system:
            "Explain this tool to a developer in 1-2 plain sentences: what it is and the problem it solves. No marketing.",
          user: `Tool: ${t}\nRegistry summary: ${meta}`,
          schema: z.object({ summary: z.string() }),
        })
      ).summary,

    verify: async (url: string): Promise<boolean> => {
      try {
        const r = await fetch(url);
        return r.ok;
      } catch {
        return false;
      }
    },

    projects: async (t: string, summary: string) =>
      extractJSON(client, {
        system:
          "Suggest hands-on projects to learn this tool: 1-2 small + 1 big, one line each.",
        user: `Tool: ${t}\nDescription: ${summary}`,
        schema: z.object({ small: z.array(z.string()), big: z.array(z.string()) }),
      }),
  };

  return Response.json(await study(deps, tool));
}
