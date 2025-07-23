import Redis from "ioredis";
import { Duration } from "pv-duration";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ThrottlingRateLimiter } from "../../src/algorithms/throttling";
import { IORedisThrottlingRateLimiter } from "../../src/ioredis/IORedisThrottling";
import { useRedisContainer } from "../__utils__/containers";

describe("IORedisThrottlingRateLimiter", () => {
  const getRedisContainer = useRedisContainer();

  let throttler: ThrottlingRateLimiter;
  let redisClient: Redis;

  beforeEach(() => {
    const container = getRedisContainer();
    redisClient = new Redis(container?.getConnectionUrl() ?? "");

    throttler = new IORedisThrottlingRateLimiter(
      redisClient,
      "test-th",
      Duration.ofSeconds(1) // 1 second minimum interval
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Constructor", () => {
    it("should create a throttler with valid parameters", () => {
      const throttler = new IORedisThrottlingRateLimiter(
        redisClient,
        "test-th",
        Duration.ofSeconds(1)
      );
      expect(throttler.getMinInterval()).toBe(1000);
      expect(throttler.getMinIntervalSeconds()).toBe(1);
    });

    it("should throw error for zero interval", () => {
      expect(() => {
        new IORedisThrottlingRateLimiter(
          redisClient,
          "test-th",
          Duration.ofSeconds(0)
        );
      }).toThrow("Minimum interval must be a positive value.");
    });

    it("should handle millisecond intervals correctly", () => {
      const throttler = new IORedisThrottlingRateLimiter(
        redisClient,
        "test-th",
        Duration.ofMilliseconds(500)
      );
      expect(throttler.getMinInterval()).toBe(500);
      expect(throttler.getMinIntervalSeconds()).toBe(1); // Rounded up
    });
  });

  describe("throttle()", () => {
    it("should allow first request immediately", async () => {
      const result = await throttler.throttle("test-key-1");
      expect(result.success).toBe(true);
      expect(result.waitTime).toBe(0);
      expect(result.nextAllowedAt).toBeGreaterThan(0);
    });

    it("should throttle subsequent requests within the interval", async () => {
      // First request should succeed
      const result1 = await throttler.throttle("test-key-2");
      expect(result1.success).toBe(true);

      // Second request should be throttled
      const result2 = await throttler.throttle("test-key-2");
      expect(result2.success).toBe(false);
      expect(result2.waitTime).toBeGreaterThan(0);
      expect(result2.nextAllowedAt).toBeGreaterThan(Date.now());
    });

    it("should handle multiple keys independently", async () => {
      const result1 = await throttler.throttle("user-1");
      const result2 = await throttler.throttle("user-2");

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Second request for user-1 should be throttled
      const result3 = await throttler.throttle("user-1");
      expect(result3.success).toBe(false);

      // But user-2 should still be allowed
      const result4 = await throttler.throttle("user-2");
      expect(result4.success).toBe(false);
    });

    it("should allow requests after the interval has passed", async () => {
      vi.useFakeTimers();
      const initialTime = new Date("2023-01-01T00:00:00.000Z").getTime();
      vi.setSystemTime(initialTime);

      // First request
      const result1 = await throttler.throttle("time-test");
      expect(result1.success).toBe(true);

      // Second request should be throttled
      const result2 = await throttler.throttle("time-test");
      expect(result2.success).toBe(false);

      // Move time forward by 1 second
      vi.setSystemTime(initialTime + 1000);

      // Third request should be allowed
      const result3 = await throttler.throttle("time-test");
      expect(result3.success).toBe(true);
    });

    it("should calculate correct wait times", async () => {
      vi.useFakeTimers();
      const initialTime = new Date("2023-01-01T00:00:00.000Z").getTime();
      vi.setSystemTime(initialTime);

      // First request
      await throttler.throttle("wait-test");

      // Move time forward by 500ms
      vi.setSystemTime(initialTime + 500);

      // Second request should be throttled with 500ms wait
      const result = await throttler.throttle("wait-test");
      expect(result.success).toBe(false);
      expect(result.waitTime).toBe(500);
      expect(result.nextAllowedAt).toBe(initialTime + 1000);
    });
  });

  describe("getStatus()", () => {
    it("should return success for a new key", async () => {
      const result = await throttler.getStatus("new-key");
      expect(result.success).toBe(true);
      expect(result.waitTime).toBe(0);
    });

    it("should not update the timestamp when checking status", async () => {
      // First request
      await throttler.throttle("status-test");

      // Check status multiple times
      const status1 = await throttler.getStatus("status-test");
      const status2 = await throttler.getStatus("status-test");

      expect(status1.success).toBe(false);
      expect(status2.success).toBe(false);
      expect(status1.waitTime).toBe(status2.waitTime);
    });

    it("should return correct status after throttling", async () => {
      vi.useFakeTimers();
      const initialTime = new Date("2023-01-01T00:00:00.000Z").getTime();
      vi.setSystemTime(initialTime);

      // First request
      await throttler.throttle("status-throttle-test");

      // Move time forward by 300ms
      vi.setSystemTime(initialTime + 300);

      // Check status
      const status = await throttler.getStatus("status-throttle-test");
      expect(status.success).toBe(false);
      expect(status.waitTime).toBe(700);
      expect(status.nextAllowedAt).toBe(initialTime + 1000);
    });
  });

  describe("getMinInterval()", () => {
    it("should return the minimum interval in milliseconds", () => {
      expect(throttler.getMinInterval()).toBe(1000);
    });

    it("should handle different intervals correctly", () => {
      const throttler2 = new IORedisThrottlingRateLimiter(
        redisClient,
        "test-th",
        Duration.ofMilliseconds(2500)
      );
      expect(throttler2.getMinInterval()).toBe(2500);
    });
  });

  describe("getMinIntervalSeconds()", () => {
    it("should return the minimum interval in seconds (rounded up)", () => {
      expect(throttler.getMinIntervalSeconds()).toBe(1);
    });

    it("should round up partial seconds", () => {
      const throttler2 = new IORedisThrottlingRateLimiter(
        redisClient,
        "test-th",
        Duration.ofMilliseconds(1500)
      );
      expect(throttler2.getMinIntervalSeconds()).toBe(2);
    });
  });

  describe("Edge cases and integration", () => {
    it("should handle concurrent requests correctly", async () => {
      vi.useFakeTimers();
      const initialTime = new Date("2023-01-01T00:00:00.000Z").getTime();
      vi.setSystemTime(initialTime);

      // Launch multiple concurrent requests
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(throttler.throttle("concurrent-test"));
      }

      const results = await Promise.all(promises);

      // Only the first should succeed
      const successfulResults = results.filter((r) => r.success);
      const throttledResults = results.filter((r) => !r.success);

      expect(successfulResults).toHaveLength(1);
      expect(throttledResults).toHaveLength(4);

      // All throttled results should have the same nextAllowedAt
      const nextAllowedAt = throttledResults[0]?.nextAllowedAt;
      throttledResults.forEach((result) => {
        expect(result.nextAllowedAt).toBe(nextAllowedAt);
      });
    });

    it("should handle rapid successive requests", async () => {
      vi.useFakeTimers();
      const initialTime = new Date("2023-01-01T00:00:00.000Z").getTime();
      vi.setSystemTime(initialTime);

      const results = [];

      // Make 10 rapid requests
      for (let i = 0; i < 10; i++) {
        results.push(await throttler.throttle("rapid-test"));
      }

      // Only the first should succeed
      expect(results[0]?.success).toBe(true);
      expect(results.slice(1).every((r) => !r.success)).toBe(true);

      // All throttled results should have increasing wait times
      for (let i = 1; i < results.length; i++) {
        expect(results[i]?.waitTime).toBeGreaterThanOrEqual(
          results[i - 1]?.waitTime || 0
        );
      }
    });

    it("should handle different key formats", async () => {
      const keys = [
        "simple-key",
        "key:with:colons",
        "key-with-dashes",
        "key_with_underscores",
        "key.with.dots",
        "123numeric456",
        "mixed1:key_2.test-3",
        "", // empty key
      ];

      for (const key of keys) {
        const result1 = await throttler.throttle(key);
        const result2 = await throttler.throttle(key);

        expect(result1.success).toBe(true);
        expect(result2.success).toBe(false);
      }
    });

    it("should handle time precision correctly", async () => {
      vi.useFakeTimers();
      const initialTime = new Date("2023-01-01T00:00:00.000Z").getTime();
      vi.setSystemTime(initialTime);

      // First request
      await throttler.throttle("precision-test");

      // Move time forward by exactly 1 second
      vi.setSystemTime(initialTime + 1000);

      // Should be allowed immediately
      const result = await throttler.throttle("precision-test");
      expect(result.success).toBe(true);
      expect(result.waitTime).toBe(0);
    });

    it("should handle very short intervals", async () => {
      const shortThrottler = new IORedisThrottlingRateLimiter(
        redisClient,
        "test-th",
        Duration.ofMilliseconds(10)
      );

      vi.useFakeTimers();
      const initialTime = new Date("2023-01-01T00:00:00.000Z").getTime();
      vi.setSystemTime(initialTime);

      // First request
      await shortThrottler.throttle("short-interval-test");

      // Second request should be throttled
      const result = await shortThrottler.throttle("short-interval-test");
      expect(result.success).toBe(false);
      expect(result.waitTime).toBe(10);
    });
  });
});
