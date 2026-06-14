import { describe, it, expect } from "vitest";
import { mapPool } from "./concurrency";

describe("mapPool", () => {
  it("maps items with order preserved", async () => {
    const result = await mapPool([1, 2, 3, 4], 2, async (x) => x * 2);
    expect(result).toEqual([2, 4, 6, 8]);
  });
});
