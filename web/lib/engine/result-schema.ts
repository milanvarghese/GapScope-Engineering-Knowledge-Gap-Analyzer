import { z } from "zod";
const Stage = z.enum(["fading", "table-stakes", "current-frontier", "emerging"]);
const Have = z.enum(["solid", "partial", "missing"]);
const ConceptRel = z.object({ type: z.enum(["supersedes", "prerequisite-of", "related"]), target: z.string() });
export const ConceptSchema = z.object({ id: z.string(), name: z.string(), stage: Stage, youHave: Have, importanceForGoal: z.number(), evidence: z.array(z.string()), relationships: z.array(ConceptRel) });
export const ResourceSchema = z.object({ title: z.string(), url: z.string(), verified: z.boolean() });
export const PathStepSchema = z.object({ conceptId: z.string(), rank: z.number(), whyNow: z.string(), whatToLearn: z.string(), resources: z.array(ResourceSchema), project: z.string() });
export const PositioningSchema = z.object({ currentSignal: z.string(), evidence: z.array(z.string()), targetSignal: z.string(), gap: z.string(), moves: z.array(z.string()) });
export const AnalysisResultSchema = z.object({
  goal: z.string(), generatedAt: z.string(), targetsAnalyzed: z.number(), summary: z.string(),
  concepts: z.array(ConceptSchema), learningPath: z.array(PathStepSchema),
  projectGaps: z.array(z.object({ theme: z.string(), seenIn: z.array(z.string()), suggestion: z.string() })),
  positioning: PositioningSchema, baseline: z.object({ tools: z.array(z.string()) }),
});
