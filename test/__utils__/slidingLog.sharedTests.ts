import { describe, it, expect, vi } from "vitest";
import type { SlidingLogRateLimiter } from "../../src/algorithms/slidingLog";

export function runSlidingLogRateLimiterTests(
  getRateLimiter: () => SlidingLogRateLimiter
) {
  describe("consume()", () => {
    it("should allow requests under the limit", async () => {
      const rateLimiter = getRateLimiter();
      for (let i = 0; i < 5; i++) {
        const result = await rateLimiter.consume("test-key-1");
        expect(result.success).toBe(true);
        expect(result.remaining).toBe(5 - (i + 1));
      }
    });

    it("should deny requests over the limit", async () => {
      const rateLimiter = getRateLimiter();
      for (let i = 0; i < 5; i++) {
        await rateLimiter.consume("test-key-2");
      }
      const result = await rateLimiter.consume("test-key-2");
      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("should allow requests again after the window slides", async () => {
      const rateLimiter = getRateLimiter();
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      // Consume all available slots
      for (let i = 0; i < 5; i++) {
        vi.setSystemTime(now + i * 1000); // Space out requests
        await rateLimiter.consume("sliding-key");
      }

      // At 9 seconds, still denied
      vi.setSystemTime(now + 9 * 1000);
      let result = await rateLimiter.consume("sliding-key");
      expect(result.success).toBe(false);

      // At 10.1 seconds, the first request has expired
      vi.setSystemTime(now + 10.1 * 1000);
      result = await rateLimiter.consume("sliding-key");
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(0); // 5 in log - 1 expired + 1 new = 5, so 5-5=0 remaining
    });
  });

  describe("getRemaining()", () => {
    it("should return full limit for a new key", async () => {
      const rateLimiter = getRateLimiter();
      const remaining = await rateLimiter.getRemaining("new-key");
      expect(remaining).toBe(5);
    });

    it("should return correct remaining count after consumption", async () => {
      const rateLimiter = getRateLimiter();
      await rateLimiter.consume("count-test-1");
      await rateLimiter.consume("count-test-1");
      const remaining = await rateLimiter.getRemaining("count-test-1");
      expect(remaining).toBe(3);
    });

    it("should not consume from the log", async () => {
      const rateLimiter = getRateLimiter();
      await rateLimiter.getRemaining("count-test-2");
      const result = await rateLimiter.consume("count-test-2");
      expect(result.remaining).toBe(4);
    });
  });
}
