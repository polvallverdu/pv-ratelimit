import { describe, it, expect } from "vitest";
import type { LeakyBucketRateLimiter } from "../../src/algorithms/leakyBucket";

export function runLeakyBucketRateLimiterTests(
  getRateLimiter: () => LeakyBucketRateLimiter
) {
  describe("consume()", () => {
    it("should allow requests when bucket is not full", async () => {
      const rateLimiter = getRateLimiter();
      for (let i = 0; i < 5; i++) {
        const result = await rateLimiter.consume("q-key-1");
        expect(result.success).toBe(true);
        expect(result.remaining).toBe(5 - (i + 1));
      }
    });

    it("should reject requests when bucket is full", async () => {
      const rateLimiter = getRateLimiter();
      for (let i = 0; i < 5; i++) {
        await rateLimiter.consume("q-key-2");
      }
      const result = await rateLimiter.consume("q-key-2");
      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe("getState()", () => {
    it("should return correct state for a new bucket", async () => {
      const rateLimiter = getRateLimiter();
      const state = await rateLimiter.getState("new-q");
      expect(state.size).toBe(0);
      expect(state.remaining).toBe(5);
    });

    it("should return correct state after requests", async () => {
      const rateLimiter = getRateLimiter();
      await rateLimiter.consume("state-q");
      await rateLimiter.consume("state-q");
      const state = await rateLimiter.getState("state-q");
      expect(state.size).toBe(2);
      expect(state.remaining).toBe(3);
    });
  });
}
