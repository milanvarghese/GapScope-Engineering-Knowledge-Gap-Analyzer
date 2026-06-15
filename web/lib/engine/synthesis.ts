import { AnalysisResultSchema } from "./result-schema";
import { mapPool } from "./concurrency";
import type { Concept, PathStep, AnalysisResult } from "../result-types";

export interface SynthesisInput {
  goal: string;
  expectedSignal: string;
  baselineTools: string[];
  yourProjects: { name: string; description: string }[];
  targets: {
    handle: string;
    tools: string[];
    methodologies: string[];
    projects: { name: string; description: string }[];
  }[];
}

export interface SynthesisDeps {
  generate(prompt: { system: string; user: string }): Promise<unknown>;
  verify(url: string): Promise<boolean>;
}

export const STAGE_WEIGHT: Record<string, number> = {
  "current-frontier": 4,
  emerging: 3,
  "table-stakes": 2,
  fading: 1,
};

export function orderLearningPath(concepts: Concept[], path: PathStep[]): PathStep[] {
  const conceptMap = new Map<string, Concept>(concepts.map((c) => [c.id, c]));

  // Score each step by stageWeight * importanceForGoal desc
  const scored = path.map((step) => {
    const concept = conceptMap.get(step.conceptId);
    const weight = concept ? (STAGE_WEIGHT[concept.stage] ?? 1) * concept.importanceForGoal : 0;
    return { step, weight };
  });
  scored.sort((a, b) => b.weight - a.weight);

  const arr = scored.map((s) => ({ ...s.step }));

  // Build set of conceptIds present in the path for prerequisite resolution
  const pathIds = new Set(arr.map((s) => s.conceptId));

  // Bubble pass: enforce prerequisite-before-dependent
  // A concept C that has relationship "prerequisite-of" -> D must appear before D.
  const maxPasses = arr.length * arr.length;
  for (let pass = 0; pass < maxPasses; pass++) {
    let swapped = false;
    for (let i = 0; i < arr.length; i++) {
      const concept = conceptMap.get(arr[i].conceptId);
      if (!concept) continue;
      for (const rel of concept.relationships) {
        if (rel.type !== "prerequisite-of") continue;
        if (!pathIds.has(rel.target)) continue;
        // Find the dependent's position
        const depIdx = arr.findIndex((s) => s.conceptId === rel.target);
        if (depIdx !== -1 && depIdx < i) {
          // The prerequisite (i) is after the dependent (depIdx) — bubble up
          const temp = arr[i];
          arr.splice(i, 1);
          arr.splice(depIdx, 0, temp);
          swapped = true;
          break;
        }
      }
      if (swapped) break;
    }
    if (!swapped) break;
  }

  // Reassign rank 1..N
  return arr.map((step, idx) => ({ ...step, rank: idx + 1 }));
}

export function buildSystemPrompt(input: SynthesisInput): string {
  return `You are a senior career-gap analyst specializing in software engineering trajectories.

Your task is to analyze the gap between an engineer's current profile and a target role, and produce a structured JSON analysis.

Goal role: ${input.goal}
Expected signal for this role: ${input.expectedSignal}

Rules:
- "stage" reflects the *field trajectory* of a concept: "fading" means declining relevance; "table-stakes" means baseline expectation; "current-frontier" means what top practitioners are doing now; "emerging" means next-wave techniques.
- "youHave" positions the user's demonstrated depth relative to their own baseline (solid/partial/missing).
- "positioning" compares the user's *signal* (e.g., researcher vs builder) to the expectedSignal for the goal role.
- "projectGaps" are themes present in target engineers' projects that are absent from the user's work.
- Resources must be real, official documentation URLs (docs.python.org, pytorch.org, etc.) — not blog posts or tutorials.
- Respond with valid JSON only, no markdown, no explanation.

Output schema:
{
  "goal": string,
  "generatedAt": ISO8601 string,
  "targetsAnalyzed": number,
  "summary": string (2-3 sentence narrative),
  "concepts": [{
    "id": string (kebab-case),
    "name": string,
    "stage": "fading"|"table-stakes"|"current-frontier"|"emerging",
    "youHave": "solid"|"partial"|"missing",
    "importanceForGoal": number (1-5),
    "evidence": string[] (repo slugs showing user has this),
    "relationships": [{ "type": "supersedes"|"prerequisite-of"|"related", "target": conceptId }]
  }],
  "learningPath": [{
    "conceptId": string,
    "rank": number,
    "whyNow": string,
    "whatToLearn": string,
    "resources": [{ "title": string, "url": string, "verified": boolean }],
    "project": string (concrete project idea)
  }],
  "projectGaps": [{ "theme": string, "seenIn": string[] (repo slugs), "suggestion": string }],
  "positioning": {
    "currentSignal": string,
    "evidence": string[],
    "targetSignal": string,
    "gap": string,
    "moves": string[]
  },
  "baseline": { "tools": string[] }
}`;
}

export function buildUserPrompt(input: SynthesisInput): string {
  const baselineSection = [
    `User's baseline tools: ${input.baselineTools.join(", ") || "none listed"}`,
    `User's own projects:`,
    ...(input.yourProjects.length
      ? input.yourProjects.map((p) => `  - ${p.name}: ${p.description || "(no description)"}`)
      : ["  (none)"]),
  ].join("\n");

  const targetsSection = input.targets.length
    ? input.targets
        .map((t) =>
          [
            `Handle: ${t.handle}`,
            `  Tools: ${t.tools.join(", ") || "none"}`,
            `  Methodologies: ${t.methodologies.join(", ") || "none"}`,
            `  Projects:`,
            ...(t.projects.length
              ? t.projects.map((p) => `    - ${p.name}: ${p.description || "(no description)"}`)
              : ["    (none)"]),
          ].join("\n")
        )
        .join("\n\n")
    : "(no target engineers provided)";

  return `${baselineSection}

Target engineers to analyze (these define the "bar" for the ${input.goal} role):
${targetsSection}

Produce the AnalysisResult JSON for goal="${input.goal}" (expectedSignal="${input.expectedSignal}"). Focus on:
1. What concepts are at the current frontier for this role that the user is missing?
2. How does the user's project signal (researcher vs builder etc.) compare to the expected signal?
3. What project themes do target engineers have that the user lacks?
4. Provide a concrete, sequenced learning path with real documentation URLs.`;
}

export async function synthesize(deps: SynthesisDeps, input: SynthesisInput): Promise<AnalysisResult> {
  const rawObj = await deps.generate({
    system: buildSystemPrompt(input),
    user: buildUserPrompt(input),
  });

  const parsed = AnalysisResultSchema.parse(rawObj);

  // Verify all resource links concurrently, keeping only verified ones
  const allSteps = parsed.learningPath;
  await mapPool(allSteps, 10, async (step) => {
    const verified = await mapPool(step.resources, 5, async (resource) => {
      const ok = await deps.verify(resource.url);
      return { ...resource, verified: ok };
    });
    step.resources = verified.filter((r) => r.verified);
  });

  parsed.learningPath = orderLearningPath(parsed.concepts, parsed.learningPath);

  return parsed;
}
