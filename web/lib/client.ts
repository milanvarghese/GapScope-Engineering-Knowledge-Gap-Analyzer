import type { Report } from "./types";

export type StudyCard = {
  summary: string;
  docs: { title: string; url: string; verified: boolean }[];
  projects: { small: string[]; big: string[] };
};

export function parseSSE(chunk: string, buffer: string): { events: any[]; buffer: string } {
  let buf = buffer + chunk;
  const events: any[] = [];
  let idx: number;
  while ((idx = buf.indexOf("\n\n")) !== -1) {
    const raw = buf.slice(0, idx);
    buf = buf.slice(idx + 2);
    const line = raw.split(/\r?\n/).find((l) => l.startsWith("data: "));
    if (line) {
      try { events.push(JSON.parse(line.slice(6))); } catch { /* ignore malformed */ }
    }
  }
  return { events, buffer: buf };
}

export async function uploadResume(file: File): Promise<{ tools: string[] }> {
  const form = new FormData();
  form.append("file", file);
  const r = await fetch("/api/resume", { method: "POST", body: form });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `resume ${r.status}`);
  return r.json();
}

export async function analyzeStream(
  body: { baseline: { tools: string[] }; handles: string[]; role?: string },
  onEvent: (e: { type: string; message?: string; report?: Report }) => void,
): Promise<void> {
  const r = await fetch("/api/analyze", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!r.ok || !r.body) throw new Error((await r.json().catch(() => ({}))).error ?? `analyze ${r.status}`);
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const { events, buffer: b } = parseSSE(decoder.decode(value, { stream: true }), buffer);
    buffer = b;
    for (const e of events) onEvent(e);
  }
}

export async function fetchStudy(tool: string): Promise<StudyCard> {
  const r = await fetch(`/api/study?tool=${encodeURIComponent(tool)}`);
  if (!r.ok) throw new Error(`study ${r.status}`);
  return r.json();
}
