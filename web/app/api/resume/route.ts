import Anthropic from "@anthropic-ai/sdk";
import { parseResume } from "./_helpers";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: "Server not configured (ANTHROPIC_API_KEY)" }, { status: 500 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No PDF uploaded" }, { status: 400 });
  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  try {
    const result = await parseResume(new Anthropic({ apiKey: key }), base64);
    return Response.json(result);
  } catch (e: any) {
    return Response.json({ error: `Could not read résumé: ${e.message}` }, { status: 422 });
  }
}
