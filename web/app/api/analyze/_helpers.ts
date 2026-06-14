import type { ExtractedRepo } from "@/lib/engine/types";
import { computeGaps } from "@/lib/engine/gaps";
import { inferMethodologies, clusterMethodologies } from "@/lib/engine/methodology";
import { DEFAULT_DENOISE } from "@/lib/engine/denoise-data";
import { BOUNDS } from "@/lib/engine/config";
import { mapPool } from "@/lib/engine/concurrency";
import type { Gap, Report } from "@/lib/types";

export type AnalyzeDeps = {
  harvest(user: string): Promise<ExtractedRepo[]>;
  readmesFor(repos: ExtractedRepo[]): Promise<[string, string, string][]>;
  inferReadme(text: string): Promise<string[]>;
};

type AnalyzeBody = {
  baseline: { tools: string[] };
  handles: string[];
  role?: string;
};

type ProgressEvent = { type: "progress"; message: string };
type ResultEvent = { type: "result"; report: { meta: { generatedAt: string; role: string; targetsAnalyzed: number }; baseline: { tools: string[]; methods: string[] }; gaps: Gap[] } };

export async function* runAnalysis(
  deps: AnalyzeDeps,
  body: AnalyzeBody,
): AsyncGenerator<ProgressEvent | ResultEvent> {
  yield { type: "progress", message: "Reading targets…" };

  const handles = body.handles.slice(0, BOUNDS.MAX_PEOPLE);

  // Harvest all users concurrently, collecting outcomes in order.
  type Outcome =
    | { ok: true; user: string; repos: ExtractedRepo[] }
    | { ok: false; user: string; error: string };

  const outcomes = await mapPool<string, Outcome>(
    handles,
    BOUNDS.CONCURRENCY,
    async (user) => {
      try {
        const repos = await deps.harvest(user);
        return { ok: true, user, repos };
      } catch (err: any) {
        return { ok: false, user, error: err.message ?? String(err) };
      }
    },
  );

  // Yield progress events in-order (same event shape as before), then collect repos.
  const allRepos: ExtractedRepo[] = [];
  for (const outcome of outcomes) {
    if (outcome.ok) {
      yield { type: "progress", message: `harvested ${outcome.user} (${outcome.repos.length} repos)` };
      allRepos.push(...outcome.repos);
    } else {
      yield { type: "progress", message: `skipped ${outcome.user}: ${outcome.error}` };
    }
  }

  yield { type: "progress", message: "Inferring methodologies…" };

  // readmesFor already slices to MAX_READMES and fetches concurrently (in route.ts).
  const readmes = await deps.readmesFor(allRepos);
  const tagged = await inferMethodologies(deps.inferReadme, readmes);

  const toolGaps = computeGaps(allRepos, body.baseline.tools, DEFAULT_DENOISE);
  const methodGaps = clusterMethodologies(tagged, []);
  const gaps = [...toolGaps, ...methodGaps].sort((a, b) => {
    if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
    return b.frequency - a.frequency;
  });

  yield {
    type: "result",
    report: {
      meta: {
        generatedAt: new Date().toISOString(),
        role: body.role ?? "",
        targetsAnalyzed: new Set(allRepos.map((r) => r.owner)).size,
      },
      baseline: { tools: body.baseline.tools, methods: [] },
      gaps,
    },
  };
}

export async function analyzeToReport(
  deps: AnalyzeDeps,
  body: { baseline: { tools: string[] }; handles: string[]; role?: string },
): Promise<Report> {
  let report: Report | null = null;
  for await (const e of runAnalysis(deps, body)) {
    if (e.type === "result" && e.report) report = e.report as Report;
  }
  if (!report) throw new Error("analysis produced no report");
  return report;
}
