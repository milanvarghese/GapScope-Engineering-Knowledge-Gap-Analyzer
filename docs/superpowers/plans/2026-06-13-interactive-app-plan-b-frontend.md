# Interactive App — Plan B: Frontend

> **For agentic workers:** implement task-by-task. Run from `web/`. Client lib is TDD (Vitest); UI is gated by `npm run build` + structure. Steps use `- [ ]`.

**Goal:** Replace the static dashboard homepage with the interactive flow: upload résumé → edit extracted skills → pick role / enter custom GitHub handles → Analyze → live SSE progress → ranked results (reusing existing `GapList`/`GapRow`), with per-gap "what to study" loaded lazily on expand.

**Architecture:** A top-level client component `AnalyzerApp` drives a 3-phase state machine (`setup → running → results`). A small browser client lib (`lib/client.ts`) wraps the three APIs (`/api/resume`, `/api/analyze` SSE, `/api/study`). Results render through the components built in Plan 3.

**Tech Stack:** Next.js 15 App Router (client components), TypeScript, Tailwind, the engine APIs from Plan A. Vitest for the client lib.

**Spec:** `docs/superpowers/specs/2026-06-13-gapscope-interactive-app-design.md` §1. **Reuse:** `web/components/{GapList,GapRow,Controls,BaselinePanel}.tsx`, `web/lib/types.ts`.

**Working dir:** `web/`. Run `cd web` first.

---

## Task 1: Browser client lib (SSE + fetch wrappers)

**Files:** Create `web/lib/client.ts`, `web/lib/client.test.ts`.

Functions:
- `uploadResume(file: File): Promise<{tools: string[]}>` — POST multipart to `/api/resume`.
- `parseSSE(chunk: string, buffer: string): { events: any[]; buffer: string }` — pure: accumulate raw stream text, split on `\n\n`, JSON.parse each `data: ` line, return parsed events + leftover buffer. (Unit-tested — this is the fiddly part.)
- `analyzeStream(body, onEvent): Promise<void>` — POST JSON to `/api/analyze`, read the `Response.body` reader, feed chunks through `parseSSE`, call `onEvent(e)` per event.
- `fetchStudy(tool: string): Promise<{summary:string; docs:{title:string;url:string;verified:boolean}[]; projects:{small:string[];big:string[]}}>` — GET `/api/study?tool=`.

- [ ] **Step 1 — failing test** `web/lib/client.test.ts`:
```ts
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
```
- [ ] **Step 2:** `npx vitest run lib/client.test.ts` → fails.
- [ ] **Step 3 — implement** `web/lib/client.ts`:
```ts
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
```
- [ ] **Step 4:** `npx vitest run lib/client.test.ts` → pass. Full suite green.
- [ ] **Step 5:** Commit: `git add -A && git commit -m "feat(web): browser client lib (SSE parse + API wrappers)"`

---

## Task 2: Interactive UI (setup → progress → results)

**Files:** Create `web/app/AnalyzerApp.tsx`, `web/components/{ResumeUpload,TargetPicker,ProgressFeed,SkillChips}.tsx`. Modify `web/app/page.tsx`, `web/components/GapRow.tsx`. Possibly modify `web/app/api/analyze/_helpers.ts` (baseline methods default).

**Before coding:** invoke the `frontend-design` skill and match the existing editorial/industrial visual identity already in `web/app/globals.css` + components (DM Mono / Literata / DM Sans, slate-black canvas, amber=tool, sage=methodology). **No Anthropic/Claude branding or mentions anywhere.** Read the existing `GapList.tsx`, `GapRow.tsx`, `Controls.tsx`, `BaselinePanel.tsx`, `Dashboard.tsx`, `globals.css`, `lib/types.ts` first to reuse their styles/props.

Requirements:

- [ ] **`AnalyzerApp.tsx`** (client component, `"use client"`) — the state machine:
  - state: `phase: "setup" | "running" | "results"`, `skills: string[]`, `role: string`, `handles: string[]`, `progress: string[]`, `report: Report | null`, `error: string | null`.
  - **setup phase** renders `ResumeUpload` (calls `uploadResume`, on success sets `skills` and shows them as editable `SkillChips`), and `TargetPicker` (role `<select>` from a small static list `["ai-engineer","devops","security"]` + an input to add custom GitHub handles as removable chips). An **Analyze** button — disabled unless `skills.length > 0 && handles.length > 0`.
  - on Analyze → `phase="running"`, clear progress, call `analyzeStream({baseline:{tools:skills}, handles, role}, onEvent)`. `onEvent`: if `type==="progress"` append `e.message` to `progress`; if `type==="result"` set `report=e.report`, `phase="results"`. Catch errors → set `error`, `phase="setup"`.
  - **running phase** renders `ProgressFeed` (the streamed `progress` lines, newest at bottom, with a spinner/“analyzing…”).
  - **results phase** renders the existing results UI: a header (role, targetsAnalyzed, generatedAt), `Controls`, `GapList` (pass `report.gaps`), `BaselinePanel` (pass `report.baseline.tools`). A "← New analysis" button resets to setup.
- [ ] **`ResumeUpload.tsx`** — a styled file input / dropzone (`accept="application/pdf"`); on file chosen, calls the passed `onUpload(file)` and shows a "reading résumé…" state.
- [ ] **`SkillChips.tsx`** — renders `skills` as removable chips (✕ removes), plus an input to manually add a skill. Controlled via props (`skills`, `onChange`).
- [ ] **`TargetPicker.tsx`** — role `<select>` + a text input that adds typed handles to a removable-chip list (controlled via props `role,onRole,handles,onHandles`).
- [ ] **`ProgressFeed.tsx`** — renders `string[]` progress lines in the mono style, with a subtle animated "working" indicator.
- [ ] **`GapRow.tsx` change** — when a row is expanded AND its gap has no `research.summary` yet, call `fetchStudy(gap.id)` once, show a small "researching…" state, then render the returned `summary`, verified `docs` (external links), and `projects.small`/`projects.big`. Keep the existing collapsed/expanded styling. (If `gap.research?.summary` is already present from the stream, render it directly without fetching.)
- [ ] **`page.tsx` change** — replace the static `data.json`-fetching `ClientPage` with `<AnalyzerApp />`. Remove now-unused static-fetch code (`ClientPage.tsx` may be deleted if nothing else uses it). The `public/data.json` sample can stay for reference but is no longer loaded.
- [ ] **Baseline methods default** — ensure `report.baseline` always has `methods` (the analyze stream yields `{tools}`); either set `baseline:{tools:body.baseline.tools, methods:[]}` in `web/app/api/analyze/_helpers.ts`, or default it in `BaselinePanel`/`AnalyzerApp`. Pick one and make `BaselinePanel` safe against missing `methods`.

- [ ] **Verify:** `npm run build` passes (type-check + compile) with no errors. Run the full Vitest suite (still green). Manually confirm (read the code) the setup→running→results flow is wired and no "Claude"/"Anthropic" text appears in any component.
- [ ] **Commit:** `git add -A && git commit -m "feat(web): interactive résumé→analyze→results UI"`

---

## Self-Review

- §1 upload résumé → editable skills → ResumeUpload + SkillChips (Task 2). ✅
- §1 role defaults + custom handles → TargetPicker (Task 2). ✅
- §1 Analyze → live SSE progress → analyzeStream + ProgressFeed (Tasks 1, 2). ✅
- §1 results in existing components + lazy study on expand → GapList reuse + GapRow study fetch (Task 2). ✅
- §3 `/api/study` shape consumed by `fetchStudy`/GapRow. ✅
- Baseline `methods` default handled (Task 2 last step). ✅
- Gate: `npm run build` + Vitest (client lib unit-tested; UI build-gated since component DOM tests need extra setup — documented tradeoff). ✅
- **Type consistency:** `Report`/`Gap` from `lib/types.ts` throughout; `StudyCard` shape matches `/api/study` return; `analyzeStream` event union matches what `/api/analyze` emits (`progress`/`result`). ✅
