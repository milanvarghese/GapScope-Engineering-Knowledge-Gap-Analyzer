import Anthropic from "@anthropic-ai/sdk";
import { extractSkillsFromPdf } from "@/lib/engine/anthropic";

export async function parseResume(client: Anthropic, base64: string): Promise<{ tools: string[] }> {
  return { tools: await extractSkillsFromPdf(client, base64) };
}
