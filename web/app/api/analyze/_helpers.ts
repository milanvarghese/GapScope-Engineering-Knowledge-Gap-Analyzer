import type { ExtractedRepo } from "@/lib/engine/types";
import { computeGaps } from "@/lib/engine/gaps";
import { inferMethodologies, clusterMethodologies } from "@/lib/engine/methodology";
import { DEFAULT_DENOISE } from "@/lib/engine/denoise-data";
import { BOUNDS } from "@/lib/engine/config";
import type { Gap } from "@/lib/types";

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
type ResultEvent = { type: "result"; report: { meta: { generatedAt: string; role: string; targetsAnalyzed: number }; baseline: { tools: string[] }; gaps: Gap[] } };

export async function* runAnalysis(
  deps: AnalyzeDeps,
  body: AnalyzeBody,
): AsyncGenerator<ProgressEvent | ResultEvent> {
  yield { type: "progress", message: "Reading targets…" };

  const handles = body.handles.slice(0, BOUNDS.MAX_PEOPLE);
  const allRepos: ExtractedRepo[] = [];

  for (const user of handles) {
    try {
      const repos = await deps.harvest(user);
      yield { type: "progress", message: `harvested ${user} (${repos.length} repos)` };
      allRepos.push(...repos);
    } catch (err: any) {
      yield { type: "progress", message: `skipped ${user}: ${err.message ?? String(err)}` };
    }
  }

  yield { type: "progress", message: "Inferring methodologies…" };

  const readmesRaw = await deps.readmesFor(allRepos);
  const readmes = readmesRaw.slice(0, BOUNDS.MAX_READMES);
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
      baseline: body.baseline,
      gaps,
    },
  };
}
