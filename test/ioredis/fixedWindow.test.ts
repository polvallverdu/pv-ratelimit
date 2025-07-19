import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useRedisContainer } from "../__utils__/containers";
import { IORedisFixedWindowRateLimiter } from "../../src/ioredis/IORedisFixedWindow";
import type { FixedWindowRateLimiter } from "../../src/algorithms/fixedWindow";
import Redis from "ioredis";
import { Duration } from "pv-duration";

describe("FixedWindowRateLimiter", () => {
  const getRedisContainer = useRedisContainer();

  let rateLimiter: FixedWindowRateLimiter;
  let redisClient: Redis;

  beforeEach(() => {
    const container = getRedisContainer();
    redisClient = new Redis(container?.getConnectionUrl() ?? "");

    rateLimiter = new IORedisFixedWindowRateLimiter(
      redisClient,
      10, // limit
      Duration.ofSeconds(60) // interval (60 seconds)
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Constructor", () => {
    it("should create a rate limiter with valid parameters", () => {
      const limiter = new IORedisFixedWindowRateLimiter(
        redisClient,
        10,
        Duration.ofSeconds(60)
      );
      expect(limiter.getLimit()).toBe(10);
      expect(limiter.getInterval()).toBe(60);
    });

    it("should throw error for zero limit", () => {
      expect(() => {
        new IORedisFixedWindowRateLimiter(
          redisClient,
          0,
          Duration.ofSeconds(60)
        );
      }).toThrow("Limit and interval must be positive values.");
    });

    it("should throw error for zero interval", () => {
      expect(() => {
        new IORedisFixedWindowRateLimiter(
          redisClient,
          10,
          Duration.ofSeconds(0)
        );
      }).toThrow("Limit and interval must be positive values.");
    });
  });

  describe("consume()", () => {
    it("should consume tokens successfully when under the limit", async () => {
      for (let i = 0; i < 10; i++) {
        const result = await rateLimiter.consume("test-key-1");
        expect(result.success).toBe(true);
        expect(result.remaining).toBe(10 - (i + 1));
      }
    });

    it("should fail when the limit is exceeded", async () => {
      for (let i = 0; i < 10; i++) {
        await rateLimiter.consume("test-key-2");
      }
      const result = await rateLimiter.consume("test-key-2");
      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("should handle multiple keys independently", async () => {
      const result1 = await rateLimiter.consume("user-1");
      await rateLimiter.consume("user-1");
      const result2 = await rateLimiter.consume("user-2");

      expect(result1.success).toBe(true);
      expect(result1.remaining).toBe(9);

      const finalResult1 = await rateLimiter.consume("user-1");
      expect(finalResult1.remaining).toBe(7);

      expect(result2.success).toBe(true);
      expect(result2.remaining).toBe(9);
    });

    it("should reset the count in a new window", async () => {
      vi.useFakeTimers();
      const initialTime = new Date("2023-01-01T00:00:00.000Z").getTime();
      vi.setSystemTime(initialTime);

      for (let i = 0; i < 10; i++) {
        await rateLimiter.consume("window-test");
      }

      let result = await rateLimiter.consume("window-test");
      expect(result.success).toBe(false);

      // Move to the next window
      vi.setSystemTime(initialTime + 60 * 1000);

      result = await rateLimiter.consume("window-test");
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(9);
    });
  });

  describe("getRemaining()", () => {
    it("should return the full limit for a new key", async () => {
      const remaining = await rateLimiter.getRemaining("new-key");
      expect(remaining).toBe(10);
    });

    it("should return the correct remaining count after consumption", async () => {
      await rateLimiter.consume("count-test");
      await rateLimiter.consume("count-test");
      await rateLimiter.consume("count-test");
      const remaining = await rateLimiter.getRemaining("count-test");
      expect(remaining).toBe(7);
    });

    it("should not consume tokens", async () => {
      await rateLimiter.getRemaining("get-test");
      const result = await rateLimiter.consume("get-test");
      expect(result.remaining).toBe(9);
    });
  });
});
