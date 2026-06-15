import { describe, it, expect } from "vitest";
import { normalizeHandle } from "./handle";

describe("normalizeHandle", () => {
  it("leaves a bare username unchanged", () => {
    expect(normalizeHandle("milanvarghese")).toBe("milanvarghese");
  });

  it("strips leading @", () => {
    expect(normalizeHandle("@milanvarghese")).toBe("milanvarghese");
  });

  it("strips github.com/ prefix (no scheme)", () => {
    expect(normalizeHandle("github.com/milanvarghese")).toBe("milanvarghese");
  });

  it("strips https://github.com/ prefix", () => {
    expect(normalizeHandle("https://github.com/milanvarghese")).toBe("milanvarghese");
  });

  it("strips https://www.github.com/ with trailing slash", () => {
    expect(normalizeHandle("https://www.github.com/milanvarghese/")).toBe("milanvarghese");
  });

  it("strips repo path — keeps only the username segment", () => {
    expect(normalizeHandle("https://github.com/milanvarghese/some-repo")).toBe("milanvarghese");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeHandle("  milanvarghese  ")).toBe("milanvarghese");
  });
});
