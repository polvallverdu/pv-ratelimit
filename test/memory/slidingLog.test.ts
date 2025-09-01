import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemorySlidingLog } from "../../src/memory/MemorySlidingLog";
import { runSlidingLogRateLimiterTests } from "../__utils__/slidingLog.sharedTests";
import { Duration } from "pv-duration";

describe("MemorySlidingLog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Constructor", () => {
    it("should create a rate limiter with valid parameters", () => {
      const limiter = new MemorySlidingLog(10, Duration.ofSeconds(10));
      expect(limiter.getLimit()).toBe(10);
      expect(limiter.getInterval()).toBe(10);
    });

    it("should throw error for zero limit", () => {
      expect(() => {
        new MemorySlidingLog(0, Duration.ofSeconds(10));
      }).toThrow("Limit must be greater than 0");
    });

    it("should throw error for zero interval", () => {
      expect(() => {
        new MemorySlidingLog(10, Duration.ofSeconds(0));
      }).toThrow("Interval must be greater than 0");
    });

    it("should throw error for negative limit", () => {
      expect(() => {
        new MemorySlidingLog(-1, Duration.ofSeconds(10));
      }).toThrow("Limit must be greater than 0");
    });

    it("should throw error for negative interval", () => {
      expect(() => {
        new MemorySlidingLog(10, Duration.ofSeconds(-1));
      }).toThrow("Interval must be greater than 0");
    });
  });

  runSlidingLogRateLimiterTests(
    () => new MemorySlidingLog(5, Duration.ofSeconds(10))
  );
});
