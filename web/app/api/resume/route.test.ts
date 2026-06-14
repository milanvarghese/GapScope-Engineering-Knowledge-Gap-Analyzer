import { describe, it, expect } from "vitest";
import { parseResume } from "./_helpers";

const fakeClient = { messages: { create: async () => ({ content: [{ type: "text", text: '{"tools":["FastAPI","Docker"]}' }] }) } } as any;

describe("parseResume", () => {
  it("returns lowercased tools", async () => {
    expect(await parseResume(fakeClient, "BASE64")).toEqual({ tools: ["fastapi", "docker"] });
  });
});
