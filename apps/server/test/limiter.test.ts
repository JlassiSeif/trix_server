import { describe, expect, it } from "vitest";
import { RateLimiter } from "../src/limiter";

describe("RateLimiter (S22: message floods)", () => {
  it("allows a burst, then the steady rate", () => {
    let t = 0;
    const lim = new RateLimiter(10, 5, () => t);
    expect(Array.from({ length: 5 }, () => lim.take())).toEqual([true, true, true, true, true]);
    expect(lim.take()).toBe(false);
    t += 100; // 100 ms at 10/s refills one
    expect(lim.take()).toBe(true);
    expect(lim.take()).toBe(false);
    t += 10_000; // never more than the burst
    expect(Array.from({ length: 6 }, () => lim.take()).filter(Boolean)).toHaveLength(5);
  });
});
