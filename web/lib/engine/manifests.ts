import { parse as parseToml } from "smol-toml";

const SPLIT = /[<>=!~;[\s]/;

export function normalizePackageName(raw: string): string {
  return raw.trim().split(SPLIT)[0].trim().toLowerCase();
}

export function parseRequirements(text: string): Set<string> {
  const names = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#") || s.startsWith("-")) continue;
    const n = normalizePackageName(s);
    if (n) names.add(n);
  }
  return names;
}

export function parsePyproject(text: string): Set<string> {
  const data = parseToml(text) as any;
  const names = new Set<string>();
  const project = data.project ?? {};
  for (const dep of project.dependencies ?? []) names.add(normalizePackageName(String(dep)));
  for (const group of Object.values(project["optional-dependencies"] ?? {}))
    for (const dep of group as string[]) names.add(normalizePackageName(String(dep)));
  const poetry = data.tool?.poetry?.dependencies ?? {};
  for (const key of Object.keys(poetry)) if (key.toLowerCase() !== "python") names.add(normalizePackageName(key));
  names.delete("");
  return names;
}

export function parsePackageJson(text: string): Set<string> {
  const data = JSON.parse(text);
  const names = new Set<string>();
  for (const section of ["dependencies", "devDependencies"])
    for (const key of Object.keys(data[section] ?? {})) names.add(normalizePackageName(key));
  names.delete("");
  return names;
}

const PARSERS: Record<string, (t: string) => Set<string>> = {
  "requirements.txt": parseRequirements,
  "pyproject.toml": parsePyproject,
  "package.json": parsePackageJson,
};
export const MANIFEST_NAMES = Object.keys(PARSERS);

export function parseManifest(filename: string, text: string): Set<string> {
  const p = PARSERS[filename];
  return p ? p(text) : new Set<string>();
}

export function isDependencyDump(filename: string, text: string): boolean {
  if (filename !== "requirements.txt") return false;
  const names = parseRequirements(text);
  if (names.size < 80) return false;
  let pinned = 0;
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (s && !s.startsWith("#") && !s.startsWith("-") && s.includes("==")) pinned++;
  }
  return pinned / Math.max(names.size, 1) >= 0.9;
}
