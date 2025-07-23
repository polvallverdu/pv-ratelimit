import Redis from "ioredis";
import { Duration } from "pv-duration";
import { beforeEach, describe, expect, it } from "vitest";
import { IORedisLeakyBucketRateLimiter } from "../../src/ioredis/IORedisLeakyBucket";
import { useRedisContainer } from "../__utils__/containers";
import { runLeakyBucketRateLimiterTests } from "../__utils__/leakyBucket.sharedTests";

describe("LeakyBucketRateLimiter", () => {
  const getRedisContainer = useRedisContainer();

  let redisClient: Redis;

  beforeEach(() => {
    const container = getRedisContainer();
    redisClient = new Redis(container?.getConnectionUrl() ?? "");
  });

  describe("Constructor", () => {
    it("should create a rate limiter with valid parameters", () => {
      const limiter = new IORedisLeakyBucketRateLimiter(
        redisClient,
        "test-lb",
        10,
        Duration.ofSeconds(60)
      );
      expect(limiter.getCapacity()).toBe(10);
    });

    it("should throw for invalid capacity", () => {
      expect(
        () =>
          new IORedisLeakyBucketRateLimiter(
            redisClient,
            "test-lb",
            0,
            Duration.ofSeconds(60)
          )
      ).toThrow();
    });
  });

  runLeakyBucketRateLimiterTests(
    () =>
      new IORedisLeakyBucketRateLimiter(
        redisClient,
        "test-lb",
        5,
        Duration.ofSeconds(60)
      )
  );
});
