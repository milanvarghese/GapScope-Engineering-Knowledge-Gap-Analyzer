import { describe, it, expect } from "vitest";
import {
  normalizePackageName, parseRequirements, parsePyproject,
  parsePackageJson, parseManifest, MANIFEST_NAMES, isDependencyDump,
} from "./manifests";

describe("manifests", () => {
  it("normalizes version/extras/case/markers", () => {
    expect(normalizePackageName("FastAPI==0.110.0")).toBe("fastapi");
    expect(normalizePackageName("uvicorn[standard]>=0.27")).toBe("uvicorn");
    expect(normalizePackageName("torch ; python_version >= '3.9'")).toBe("torch");
    expect(normalizePackageName("@anthropic-ai/sdk")).toBe("@anthropic-ai/sdk");
  });
  it("parses requirements ignoring noise", () => {
    const text = "# c\nFastAPI==0.110.0\nuvicorn[standard]>=0.27\nlangchain\n-r o.txt\n--index-url x\ntorch ; python_version >= '3.9'\n\n";
    expect(parseRequirements(text)).toEqual(new Set(["fastapi", "uvicorn", "langchain", "torch"]));
  });
  it("parses pyproject pep621 + optional", () => {
    const text = '[project]\nname="x"\ndependencies=["fastapi>=0.110","httpx","pydantic>=2"]\n[project.optional-dependencies]\ndev=["pytest"]\n';
    expect(parsePyproject(text)).toEqual(new Set(["fastapi", "httpx", "pydantic", "pytest"]));
  });
  it("parses package.json deps+dev", () => {
    const text = '{"dependencies":{"react":"^18","next":"14.0.0"},"devDependencies":{"typescript":"^5"}}';
    expect(parsePackageJson(text)).toEqual(new Set(["react", "next", "typescript"]));
  });
  it("dispatches and lists names", () => {
    expect(parseManifest("requirements.txt", "flask\n")).toEqual(new Set(["flask"]));
    expect(parseManifest("unknown.txt", "flask\n")).toEqual(new Set());
    expect(MANIFEST_NAMES).toContain("package.json");
  });
  it("detects pip-freeze dump", () => {
    const dump = Array.from({ length: 100 }, (_, i) => `pkg${i}==1.${i}`).join("\n");
    expect(isDependencyDump("requirements.txt", dump)).toBe(true);
    expect(isDependencyDump("requirements.txt", "flask\nfastapi==2.0\n")).toBe(false);
    expect(isDependencyDump("package.json", dump)).toBe(false);
  });
});
