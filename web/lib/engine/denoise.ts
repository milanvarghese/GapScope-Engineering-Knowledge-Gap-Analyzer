export type DenoiseRules = {
  denylistExact: Set<string>;
  denylistPrefix: string[];
  groups: Record<string, string>;
};

export function applyDenoise(tools: Set<string>, rules: DenoiseRules): Set<string> {
  const out = new Set<string>();
  for (const tool of tools) {
    const t = tool.toLowerCase();
    if (rules.denylistExact.has(t) || rules.denylistPrefix.some((p) => t.startsWith(p))) continue;
    out.add(rules.groups[t] ?? t);
  }
  return out;
}
