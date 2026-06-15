export function normalizeHandle(input: string): string {
  let s = input.trim().replace(/^@/, "");
  s = s.replace(/^https?:\/\//i, "");
  s = s.replace(/^(www\.)?github\.com\//i, "");
  s = s.split(/[/?#]/)[0];
  s = s.replace(/\.git$/i, "");
  return s.trim();
}
