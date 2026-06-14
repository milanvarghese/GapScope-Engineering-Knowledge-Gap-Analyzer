import { describe, it, expect } from "vitest";
import { z } from "zod";
import { extractJSON } from "./anthropic";

function fakeClient(jsonText: string) {
  return { messages: { create: async () => ({ content: [{ type: "text", text: jsonText }] }) } } as any;
}

describe("extractJSON", () => {
  it("parses and validates JSON from the text block", async () => {
    const client = fakeClient('{"tools":["fastapi","langchain"]}');
    const out = await extractJSON(client, {
      system: "s", user: "u", schema: z.object({ tools: z.array(z.string()) }),
    });
    expect(out.tools).toEqual(["fastapi", "langchain"]);
  });
  it("strips code fences if present", async () => {
    const client = fakeClient('```json\n{"tools":["x"]}\n```');
    const out = await extractJSON(client, { system: "s", user: "u", schema: z.object({ tools: z.array(z.string()) }) });
    expect(out.tools).toEqual(["x"]);
  });
});
