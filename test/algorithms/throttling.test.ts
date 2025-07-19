import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useRedisContainer } from "../__utils__/containers";
import { ThrottlingRateLimiter } from "../../src/algorithms/throttling";
import Redis from "ioredis";

describe("ThrottlingRateLimiter", () => {
  const getRedisContainer = useRedisContainer();

  let throttler: ThrottlingRateLimiter;
  let redisClient: Redis;

  beforeEach(() => {
    const container = getRedisContainer();
    redisClient = new Redis(container?.getConnectionUrl() ?? "");

    throttler = new ThrottlingRateLimiter(
      redisClient,
      1 // 10 second cooldown
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("consume()", () => {
    it("should allow the first request", async () => {
      const result = await throttler.consume("throttle-key-1");
      expect(result.success).toBe(true);
    });

    it("should deny the second request immediately", async () => {
      await throttler.consume("throttle-key-2");
      const result = await throttler.consume("throttle-key-2");
      expect(result.success).toBe(false);
    });

    it("should report the correct next availability time", async () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      const result1 = await throttler.consume("throttle-key-3");
      expect(result1.nextAvailableAt).toBeCloseTo(now / 1000, 0);

      const result2 = await throttler.consume("throttle-key-3");
      expect(result2.nextAvailableAt).toBeCloseTo((now + 10000) / 1000, 0);
    });

    it("should allow requests again after the cooldown", async () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      await throttler.consume("throttle-key-4");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const result = await throttler.consume("throttle-key-4");
      expect(result.success).toBe(true);
    });
  });

  describe("getNextAvailableAt()", () => {
    it("should return the current time for a new key", async () => {
      const now = Date.now() / 1000;
      const availableAt = await throttler.getNextAvailableAt(
        "new-throttle-key"
      );
      expect(availableAt).toBeCloseTo(now, 0);
    });

    it("should return the future availability time for a consumed key", async () => {
      const now = Date.now() / 1000;
      await throttler.consume("active-throttle-key");
      const availableAt = await throttler.getNextAvailableAt(
        "active-throttle-key"
      );
      expect(availableAt).toBeCloseTo(now + 10, 0);
    });
  });
});
