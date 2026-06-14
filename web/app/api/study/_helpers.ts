import { DOCS_REGISTRY } from "@/lib/engine/config";

export type StudyDeps = {
  pypiSummary(name: string): Promise<string | null>;
  summarize(tool: string, meta: string): Promise<string>;
  verify(url: string): Promise<boolean>;
  projects(tool: string, summary: string): Promise<{ small: string[]; big: string[] }>;
};

export async function study(
  deps: StudyDeps,
  tool: string,
): Promise<{ summary: string; docs: { title: string; url: string; verified: boolean }[]; projects: { small: string[]; big: string[] } }> {
  const meta = await deps.pypiSummary(tool);
  const summary = meta
    ? await deps.summarize(tool, meta)
    : `${tool}: no registry description found.`;

  const candidates: string[] = [
    ...(DOCS_REGISTRY[tool] ? [DOCS_REGISTRY[tool]] : []),
    `https://pypi.org/project/${tool}/`,
  ];

  let docs: { title: string; url: string; verified: boolean }[] = [];
  for (const url of candidates) {
    if (await deps.verify(url)) {
      docs = [{ title: `${tool} docs`, url, verified: true }];
      break;
    }
  }

  const projects = await deps.projects(tool, summary);

  return { summary, docs, projects };
}
