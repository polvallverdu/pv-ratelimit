import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryThrottling } from "../../src/memory/MemoryThrottling";
import { runThrottlingRateLimiterTests } from "../__utils__/throttling.sharedTests";
import { Duration } from "pv-duration";

describe("MemoryThrottling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Constructor", () => {
    it("should create a rate limiter with valid parameters", () => {
      const limiter = new MemoryThrottling(Duration.ofSeconds(1));
      expect(limiter.getMinInterval()).toBe(1000);
    });

    it("should throw error for zero min interval", () => {
      expect(() => {
        new MemoryThrottling(Duration.ofSeconds(0));
      }).toThrow("Minimum interval must be greater than 0");
    });

    it("should throw error for negative min interval", () => {
      expect(() => {
        new MemoryThrottling(Duration.ofSeconds(-1));
      }).toThrow("Minimum interval must be greater than 0");
    });
  });

  runThrottlingRateLimiterTests(
    () => new MemoryThrottling(Duration.ofSeconds(1)) // 1 second minimum interval
  );
});
