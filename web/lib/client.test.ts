import { describe, it, expect } from "vitest";
import { parseSSE } from "./client";

describe("parseSSE", () => {
  it("parses complete events and keeps partial buffer", () => {
    const r1 = parseSSE('data: {"type":"progress","message":"a"}\n\n', "");
    expect(r1.events).toEqual([{ type: "progress", message: "a" }]);
    expect(r1.buffer).toBe("");
  });
  it("buffers an incomplete event until its terminator arrives", () => {
    const r1 = parseSSE('data: {"type":"prog', "");
    expect(r1.events).toEqual([]);
    const r2 = parseSSE('ress","message":"b"}\n\n', r1.buffer);
    expect(r2.events).toEqual([{ type: "progress", message: "b" }]);
  });
  it("parses multiple events in one chunk", () => {
    const r = parseSSE('data: {"type":"progress","message":"x"}\n\ndata: {"type":"result","report":{}}\n\n', "");
    expect(r.events.length).toBe(2);
    expect(r.events[1].type).toBe("result");
  });
});
