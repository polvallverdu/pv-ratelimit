import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryLeakyBucket } from "../../src/memory/MemoryLeakyBucket";
import { runLeakyBucketRateLimiterTests } from "../__utils__/leakyBucket.sharedTests";

describe("MemoryLeakyBucket", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Constructor", () => {
    it("should create a rate limiter with valid parameters", () => {
      const limiter = new MemoryLeakyBucket(10);
      expect(limiter.getCapacity()).toBe(10);
    });

    it("should create a rate limiter with custom cleanup interval", () => {
      const limiter = new MemoryLeakyBucket(10, 30 * 60 * 1000); // 30 minutes
      expect(limiter.getCapacity()).toBe(10);
    });

    it("should throw error for zero capacity", () => {
      expect(() => {
        new MemoryLeakyBucket(0);
      }).toThrow("Capacity must be greater than 0");
    });

    it("should throw error for negative capacity", () => {
      expect(() => {
        new MemoryLeakyBucket(-1);
      }).toThrow("Capacity must be greater than 0");
    });

    it("should throw error for zero cleanup interval", () => {
      expect(() => {
        new MemoryLeakyBucket(10, 0);
      }).toThrow("Cleanup interval must be greater than 0");
    });

    it("should throw error for negative cleanup interval", () => {
      expect(() => {
        new MemoryLeakyBucket(10, -1);
      }).toThrow("Cleanup interval must be greater than 0");
    });
  });

  runLeakyBucketRateLimiterTests(() => new MemoryLeakyBucket(5));
});
