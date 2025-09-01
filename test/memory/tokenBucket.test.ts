import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryTokenBucket } from "../../src/memory/MemoryTokenBucket";
import { runTokenBucketRateLimiterTests } from "../__utils__/tokenBucket.sharedTests";
import { Duration } from "pv-duration";

describe("MemoryTokenBucket", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Constructor", () => {
    it("should create a rate limiter with valid parameters", () => {
      const limiter = new MemoryTokenBucket(10, 2, Duration.ofSeconds(60));
      expect(limiter.getCapacity()).toBe(10);
      expect(limiter.getRefillAmount()).toBe(2);
      expect(limiter.getRefillInterval()).toBe(60);
    });

    it("should throw error for zero capacity", () => {
      expect(() => {
        new MemoryTokenBucket(0, 2, Duration.ofSeconds(60));
      }).toThrow("Capacity must be greater than 0");
    });

    it("should throw error for zero refill amount", () => {
      expect(() => {
        new MemoryTokenBucket(10, 0, Duration.ofSeconds(60));
      }).toThrow("Refill amount must be greater than 0");
    });

    it("should throw error for zero refill interval", () => {
      expect(() => {
        new MemoryTokenBucket(10, 2, Duration.ofSeconds(0));
      }).toThrow("Refill interval must be greater than 0");
    });

    it("should throw error for negative capacity", () => {
      expect(() => {
        new MemoryTokenBucket(-1, 2, Duration.ofSeconds(60));
      }).toThrow("Capacity must be greater than 0");
    });

    it("should throw error for negative refill amount", () => {
      expect(() => {
        new MemoryTokenBucket(10, -1, Duration.ofSeconds(60));
      }).toThrow("Refill amount must be greater than 0");
    });

    it("should throw error for negative refill interval", () => {
      expect(() => {
        new MemoryTokenBucket(10, 2, Duration.ofSeconds(-1));
      }).toThrow("Refill interval must be greater than 0");
    });
  });

  runTokenBucketRateLimiterTests(
    () => new MemoryTokenBucket(10, 5, Duration.ofSeconds(60))
  );
});
