import Redis from "ioredis";
import { Duration } from "pv-duration";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IORedisThrottlingRateLimiter } from "../../src/ioredis/IORedisThrottling";
import { useRedisContainer } from "../__utils__/containers";
import { runThrottlingRateLimiterTests } from "../__utils__/throttling.sharedTests";

describe("IORedisThrottlingRateLimiter", () => {
  const getRedisContainer = useRedisContainer();

  let redisClient: Redis;

  beforeEach(() => {
    const container = getRedisContainer();
    redisClient = new Redis(container?.getConnectionUrl() ?? "");
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

  runThrottlingRateLimiterTests(
    () =>
      new IORedisThrottlingRateLimiter(
        redisClient,
        "test-th",
        Duration.ofSeconds(1)
      )
  );
});
