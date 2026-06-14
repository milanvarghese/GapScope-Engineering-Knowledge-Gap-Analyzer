import Anthropic from "@anthropic-ai/sdk";
import type { ZodType } from "zod";

export const MODEL = "claude-haiku-4-5";

function firstText(msg: any): string {
  const block = (msg.content ?? []).find((b: any) => b.type === "text");
  let t = (block?.text ?? "").trim();
  if (t.startsWith("```")) t = t.replace(/^```(?:json)?\s*/i, "").replace(/```$/m, "").trim();
  return t;
}

export async function extractJSON<T>(
  client: Anthropic,
  { system, user, schema }: { system: string; user: string; schema: ZodType<T> },
): Promise<T> {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: system + " Respond with ONLY valid minified JSON, no prose, no code fences.",
    messages: [{ role: "user", content: user }],
  });
  return schema.parse(JSON.parse(firstText(msg)));
}

export async function extractSkillsFromPdf(client: Anthropic, base64Pdf: string): Promise<string[]> {
  const { z } = await import("zod");
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: "Extract the engineering tools, libraries, languages, and platforms this person knows from their résumé. Respond with ONLY valid minified JSON: {\"tools\": string[]}. Lowercase, deduplicated, no prose.",
    messages: [{
      role: "user",
      content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64Pdf } },
        { type: "text", text: "Extract the tools/skills." },
      ],
    }],
  });
  const block = ((msg as any).content ?? []).find((b: any) => b.type === "text");
  let t = (block?.text ?? "").trim();
  if (t.startsWith("```")) t = t.replace(/^```(?:json)?\s*/i, "").replace(/```$/m, "").trim();
  return z.object({ tools: z.array(z.string()) }).parse(JSON.parse(t)).tools.map((s) => s.toLowerCase());
}
