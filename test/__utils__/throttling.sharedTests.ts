import { describe, it, expect, vi } from "vitest";
import type { ThrottlingRateLimiter } from "../../src/algorithms/throttling";

export function runThrottlingRateLimiterTests(
  getThrottler: () => ThrottlingRateLimiter
) {
  describe("throttle()", () => {
    it("should allow first request immediately", async () => {
      const throttler = getThrottler();
      const result = await throttler.throttle("test-key-1");
      expect(result.success).toBe(true);
      expect(result.waitTime).toBe(0);
      expect(result.nextAllowedAt).toBeGreaterThan(0);
    });

    it("should throttle subsequent requests within the interval", async () => {
      const throttler = getThrottler();
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
      const throttler = getThrottler();
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
      const throttler = getThrottler();
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
      const throttler = getThrottler();
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
      const throttler = getThrottler();
      const result = await throttler.getStatus("new-key");
      expect(result.success).toBe(true);
      expect(result.waitTime).toBe(0);
    });

    it("should not update the timestamp when checking status", async () => {
      const throttler = getThrottler();
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
      const throttler = getThrottler();
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
}
