import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryFixedWindow } from "../../src/memory/MemoryFixedWindow";
import { runFixedWindowRateLimiterTests } from "../__utils__/fixedWindow.sharedTests";
import { Duration } from "pv-duration";

describe("MemoryFixedWindow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Constructor", () => {
    it("should create a rate limiter with valid parameters", () => {
      const limiter = new MemoryFixedWindow(10, Duration.ofSeconds(60));
      expect(limiter.getLimit()).toBe(10);
      expect(limiter.getInterval()).toBe(60);
    });

    it("should throw error for zero limit", () => {
      expect(() => {
        new MemoryFixedWindow(0, Duration.ofSeconds(60));
      }).toThrow("Limit must be greater than 0");
    });

    it("should throw error for zero interval", () => {
      expect(() => {
        new MemoryFixedWindow(10, Duration.ofSeconds(0));
      }).toThrow("Interval must be greater than 0");
    });

    it("should throw error for negative limit", () => {
      expect(() => {
        new MemoryFixedWindow(-1, Duration.ofSeconds(60));
      }).toThrow("Limit must be greater than 0");
    });

    it("should throw error for negative interval", () => {
      expect(() => {
        new MemoryFixedWindow(10, Duration.ofSeconds(-1));
      }).toThrow("Interval must be greater than 0");
    });
  });

  runFixedWindowRateLimiterTests(
    () => new MemoryFixedWindow(10, Duration.ofSeconds(60))
  );
});
