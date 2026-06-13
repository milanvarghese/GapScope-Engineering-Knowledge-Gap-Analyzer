export type Evidence = { repo: string; signal: string };
export type Doc = { title: string; url: string; verified: boolean };
export type Gap = {
  id: string;
  name: string;
  kind: "tool" | "methodology";
  frequency: number;
  recencyScore: number;
  rankScore: number;
  evidence: Evidence[];
  research: { summary?: string; researched?: boolean };
  docs: Doc[];
  projects: { small: string[]; big: string[] };
};
export type Report = {
  meta: { generatedAt: string; role: string; targetsAnalyzed: number };
  baseline: { tools: string[]; methods: string[] };
  gaps: Gap[];
};
