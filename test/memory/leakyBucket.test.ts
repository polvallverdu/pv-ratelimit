import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryLeakyBucket } from "../../src/memory/MemoryLeakyBucket";
import { runLeakyBucketRateLimiterTests } from "../__utils__/leakyBucket.sharedTests";
import { Duration } from "pv-duration";

describe("MemoryLeakyBucket", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Constructor", () => {
    it("should create a rate limiter with valid parameters", () => {
      const limiter = new MemoryLeakyBucket(10, Duration.ofSeconds(30));
      expect(limiter.getCapacity()).toBe(10);
    });

    it("should create a rate limiter with custom cleanup interval", () => {
      const limiter = new MemoryLeakyBucket(10, Duration.ofMinutes(30));
      expect(limiter.getCapacity()).toBe(10);
    });

    it("should throw error for zero capacity", () => {
      expect(() => {
        new MemoryLeakyBucket(0, Duration.ofSeconds(30));
      }).toThrow("Capacity must be greater than 0");
    });

    it("should throw error for negative capacity", () => {
      expect(() => {
        new MemoryLeakyBucket(-1, Duration.ofSeconds(30));
      }).toThrow("Capacity must be greater than 0");
    });

    it("should throw error for zero cleanup interval", () => {
      expect(() => {
        new MemoryLeakyBucket(10, Duration.ofSeconds(0));
      }).toThrow("Interval must be greater than 0");
    });

    it("should throw error for negative cleanup interval", () => {
      expect(() => {
        new MemoryLeakyBucket(10, Duration.ofSeconds(-1));
      }).toThrow("Interval must be greater than 0");
    });
  });

  runLeakyBucketRateLimiterTests(
    () => new MemoryLeakyBucket(5, Duration.ofSeconds(60))
  );
});
