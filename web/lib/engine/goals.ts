export interface GoalPreset { id: string; label: string; expectedSignal: string; defaultHandles: string[]; }
export const GOAL_PRESETS: GoalPreset[] = [
  { id: "founding-engineer", label: "Founding Engineer", expectedSignal: "builder/shipper/owner who takes products 0→1 and owns infra", defaultHandles: ["tiangolo", "mckaywrigley", "hwchase17"] },
  { id: "forward-deployed-engineer", label: "Forward-Deployed Engineer", expectedSignal: "pragmatic builder who ships customer-facing solutions fast", defaultHandles: ["tiangolo", "simonw", "mckaywrigley"] },
  { id: "faang-google", label: "FAANG / Google ML Engineer", expectedSignal: "depth in systems + ML at scale, rigor, fundamentals", defaultHandles: ["karpathy", "tiangolo", "samuelcolvin"] },
  { id: "ai-research-engineer", label: "AI Research Engineer", expectedSignal: "frontier ML methods, experimentation, reproducible research", defaultHandles: ["karpathy", "hwchase17", "lucidrains"] },
];
export function presetById(id: string): GoalPreset | undefined { return GOAL_PRESETS.find((g) => g.id === id); }
