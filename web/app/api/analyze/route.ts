import Anthropic from "@anthropic-ai/sdk";
import { harvestUser, realGithub } from "@/lib/engine/github";
import { synthesize } from "@/lib/engine/synthesis";
import { BOUNDS } from "@/lib/engine/config";
import { runGoalAnalysis } from "./_helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Call the Anthropic API and return the parsed JSON object (no strict schema gate here —
 *  synthesize validates with AnalysisResultSchema). */
async function extractJSONRaw(
  client: Anthropic,
  system: string,
  user: string,
): Promise<unknown> {
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    system: system + " Respond with ONLY valid minified JSON, no prose, no code fences.",
    messages: [{ role: "user", content: user }],
  });
  const block = (msg.content ?? []).find((b: any) => b.type === "text") as any;
  let t = (block?.text ?? "").trim();
  if (t.startsWith("```")) t = t.replace(/^```(?:json)?\s*/i, "").replace(/```$/m, "").trim();
  return JSON.parse(t);
}

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

      synthesize: (input: Parameters<typeof synthesize>[1]) =>
        synthesize(
          {
            generate: ({ system, user }) => extractJSONRaw(client, system, user),
            verify: async (url: string) => {
              try {
                const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000) });
                return res.ok;
              } catch {
                return false;
              }
            },
          },
          input,
        ),
    };

    const result = await runGoalAnalysis(deps, body);
    return Response.json(result);
  } catch (e: any) {
    return Response.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
