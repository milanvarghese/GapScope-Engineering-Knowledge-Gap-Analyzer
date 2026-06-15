import type { AnalysisResult } from "./result-types";

export async function analyze(body: {
  resumeSkills: string[];
  githubUsername: string;
  goal: string;
  handles: string[];
}): Promise<AnalysisResult> {
  const r = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `analyze ${r.status}`);
  return r.json();
}

export async function uploadResume(file: File): Promise<{ tools: string[] }> {
  const form = new FormData();
  form.append("file", file);
  const r = await fetch("/api/resume", { method: "POST", body: form });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `resume ${r.status}`);
  return r.json();
}
