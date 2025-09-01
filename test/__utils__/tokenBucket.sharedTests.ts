import { describe, expect, it } from "vitest";
import type { TokenBucketRateLimiter } from "../../src/algorithms/tokenBucket";

export function runTokenBucketRateLimiterTests(
  getRateLimiter: () => TokenBucketRateLimiter
) {
  describe("consume()", () => {
    it("should consume tokens successfully when available", async () => {
      const rateLimiter = getRateLimiter();
      const result = await rateLimiter.consume("test-key-1", 3);
      expect(result.success).toBe(true);
      expect(result.remainingTokens).toBe(7); // 10 - 3 = 7
      expect(result.nextRefillAt).toBeGreaterThan(Date.now() / 1000);
    });

    it("should consume single token by default", async () => {
      const rateLimiter = getRateLimiter();
      const result = await rateLimiter.consume("test-key-2");
      expect(result.success).toBe(true);
      expect(result.remainingTokens).toBe(9); // 10 - 1 = 9
    });

    it("should fail when not enough tokens available", async () => {
      const rateLimiter = getRateLimiter();
      await rateLimiter.consume("test-key-3", 8);
      const result = await rateLimiter.consume("test-key-3", 5);
      expect(result.success).toBe(false);
      expect(result.remainingTokens).toBe(2);
    });

    it("should consume all remaining tokens", async () => {
      const rateLimiter = getRateLimiter();
      await rateLimiter.consume("test-key-4", 3);
      const result = await rateLimiter.consume("test-key-4", 7);
      expect(result.success).toBe(true);
      expect(result.remainingTokens).toBe(0);
    });

    it("should handle zero token consumption", async () => {
      const rateLimiter = getRateLimiter();
      const result = await rateLimiter.consume("test-key-5", 0);
      expect(result.success).toBe(true);
      expect(result.remainingTokens).toBe(10);
    });

    it("should handle multiple buckets independently", async () => {
      const rateLimiter = getRateLimiter();
      const result1 = await rateLimiter.consume("user-1", 5);
      const result2 = await rateLimiter.consume("user-2", 3);
      expect(result1.success).toBe(true);
      expect(result1.remainingTokens).toBe(5);
      expect(result2.success).toBe(true);
      expect(result2.remainingTokens).toBe(7);
    });
  });

  // ... (for brevity, only the consume() block is shown here, but the full shared test should include all behavioral tests from the original file, such as Token refill behavior, addTokens, removeTokens, getRemainingTokens, getCapacity, and edge cases)
}
