import { describe, it, expect } from "vitest";
import { applyDenoise, type DenoiseRules } from "./denoise";

const RULES: DenoiseRules = {
  denylistExact: new Set(["postcss", "autoprefixer", "eslint"]),
  denylistPrefix: ["@types/"],
  groups: { "@radix-ui/react-dialog": "shadcn/ui", "clsx": "shadcn/ui", "@radix-ui/react-tabs": "shadcn/ui" },
};

describe("denoise", () => {
  it("drops exact + prefix denylist", () => {
    expect(applyDenoise(new Set(["react", "postcss", "@types/node", "fastapi"]), RULES))
      .toEqual(new Set(["react", "fastapi"]));
  });
  it("folds a family to one group", () => {
    expect(applyDenoise(new Set(["@radix-ui/react-dialog", "@radix-ui/react-tabs", "clsx", "react"]), RULES))
      .toEqual(new Set(["shadcn/ui", "react"]));
  });
});
