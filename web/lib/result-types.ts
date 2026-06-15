export type Stage = "fading" | "table-stakes" | "current-frontier" | "emerging";
export type Have = "solid" | "partial" | "missing";
export interface ConceptRel { type: "supersedes" | "prerequisite-of" | "related"; target: string; }
export interface Concept { id: string; name: string; stage: Stage; youHave: Have; importanceForGoal: number; evidence: string[]; relationships: ConceptRel[]; }
export interface Resource { title: string; url: string; verified: boolean; }
export interface PathStep { conceptId: string; rank: number; whyNow: string; whatToLearn: string; resources: Resource[]; project: string; }
export interface ProjectGap { theme: string; seenIn: string[]; suggestion: string; }
export interface Positioning { currentSignal: string; evidence: string[]; targetSignal: string; gap: string; moves: string[]; }
export interface Comparison {
  handle: string;
  theirSignal: string;
  theyHaveYouDont: string[];
  youHaveTheyDont: string[];
  shared: string[];
  notableProjects: string[];
  takeaway: string;
}
export interface AnalysisResult {
  goal: string; generatedAt: string; targetsAnalyzed: number; summary: string;
  concepts: Concept[]; learningPath: PathStep[]; projectGaps: ProjectGap[];
  positioning: Positioning; baseline: { tools: string[] };
  comparisons: Comparison[];
}
