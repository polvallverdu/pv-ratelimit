import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryThrottling } from "../../src/memory/MemoryThrottling";

describe("MemoryThrottling", () => {
	let throttling: MemoryThrottling;
	const minIntervalMs = 1000; // 1 second

	beforeEach(() => {
		throttling = new MemoryThrottling(minIntervalMs);
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("constructor", () => {
		it("should create a throttling rate limiter with the specified interval", () => {
			expect(throttling.getMinInterval()).toBe(minIntervalMs);
			expect(throttling.getMinIntervalSeconds()).toBe(1);
		});

		it("should throw an error for invalid interval", () => {
			expect(() => new MemoryThrottling(0)).toThrow(
				"Minimum interval must be greater than 0",
			);
			expect(() => new MemoryThrottling(-100)).toThrow(
				"Minimum interval must be greater than 0",
			);
		});
	});

	describe("throttle", () => {
		it("should allow the first request immediately", async () => {
			const result = await throttling.throttle("user1");

			expect(result.success).toBe(true);
			expect(result.waitTime).toBe(0);
			expect(result.nextAllowedAt).toBe(Date.now());
		});

		it("should throttle subsequent requests within the interval", async () => {
			const startTime = Date.now();
			vi.setSystemTime(startTime);

			// First request should succeed
			const firstResult = await throttling.throttle("user1");
			expect(firstResult.success).toBe(true);

			// Advance time by 500ms (less than the 1000ms interval)
			vi.advanceTimersByTime(500);

			// Second request should be throttled
			const secondResult = await throttling.throttle("user1");
			expect(secondResult.success).toBe(false);
			expect(secondResult.waitTime).toBe(500);
			expect(secondResult.nextAllowedAt).toBe(startTime + minIntervalMs);
		});

		it("should allow requests after the interval has passed", async () => {
			const startTime = Date.now();
			vi.setSystemTime(startTime);

			// First request
			await throttling.throttle("user1");

			// Advance time by the full interval
			vi.advanceTimersByTime(minIntervalMs);

			// Second request should succeed
			const result = await throttling.throttle("user1");
			expect(result.success).toBe(true);
			expect(result.waitTime).toBe(0);
		});

		it("should handle multiple keys independently", async () => {
			const startTime = Date.now();
			vi.setSystemTime(startTime);

			// First requests for both users should succeed
			const user1Result1 = await throttling.throttle("user1");
			const user2Result1 = await throttling.throttle("user2");

			expect(user1Result1.success).toBe(true);
			expect(user2Result1.success).toBe(true);

			// Advance time by 500ms
			vi.advanceTimersByTime(500);

			// Both users should be throttled
			const user1Result2 = await throttling.throttle("user1");
			const user2Result2 = await throttling.throttle("user2");

			expect(user1Result2.success).toBe(false);
			expect(user2Result2.success).toBe(false);
			expect(user1Result2.waitTime).toBe(500);
			expect(user2Result2.waitTime).toBe(500);
		});

		it("should update the timestamp when a request is allowed", async () => {
			const startTime = Date.now();
			vi.setSystemTime(startTime);

			await throttling.throttle("user1");
			expect(throttling.getLastRequestTime("user1")).toBe(startTime);

			// Advance time and allow another request
			vi.advanceTimersByTime(minIntervalMs);
			const newTime = Date.now();
			vi.setSystemTime(newTime);

			await throttling.throttle("user1");
			expect(throttling.getLastRequestTime("user1")).toBe(newTime);
		});
	});

	describe("getStatus", () => {
		it("should return success for a new key", async () => {
			const result = await throttling.getStatus("user1");

			expect(result.success).toBe(true);
			expect(result.waitTime).toBe(0);
		});

		it("should return throttled status without updating the timestamp", async () => {
			const startTime = Date.now();
			vi.setSystemTime(startTime);

			// Make a request to set the timestamp
			await throttling.throttle("user1");
			const originalTimestamp = throttling.getLastRequestTime("user1");

			// Advance time by 500ms
			vi.advanceTimersByTime(500);

			// Check status without updating
			const status = await throttling.getStatus("user1");
			expect(status.success).toBe(false);
			expect(status.waitTime).toBe(500);

			// Timestamp should remain unchanged
			expect(throttling.getLastRequestTime("user1")).toBe(originalTimestamp);
		});

		it("should return success after the interval has passed", async () => {
			const startTime = Date.now();
			vi.setSystemTime(startTime);

			await throttling.throttle("user1");

			// Advance time by the full interval
			vi.advanceTimersByTime(minIntervalMs);

			const status = await throttling.getStatus("user1");
			expect(status.success).toBe(true);
			expect(status.waitTime).toBe(0);
		});
	});

	describe("getMinInterval", () => {
		it("should return the minimum interval in milliseconds", () => {
			expect(throttling.getMinInterval()).toBe(minIntervalMs);
		});

		it("should return the minimum interval in seconds", () => {
			expect(throttling.getMinIntervalSeconds()).toBe(1);
		});
	});

	describe("clear", () => {
		it("should clear the throttling state for a specific key", async () => {
			const startTime = Date.now();
			vi.setSystemTime(startTime);

			await throttling.throttle("user1");
			expect(throttling.getLastRequestTime("user1")).toBe(startTime);

			throttling.clear("user1");
			expect(throttling.getLastRequestTime("user1")).toBeUndefined();

			// Should be able to make a new request immediately
			const result = await throttling.throttle("user1");
			expect(result.success).toBe(true);
		});

		it("should not affect other keys when clearing one key", async () => {
			const startTime = Date.now();
			vi.setSystemTime(startTime);

			await throttling.throttle("user1");
			await throttling.throttle("user2");

			throttling.clear("user1");

			// user1 should be cleared
			expect(throttling.getLastRequestTime("user1")).toBeUndefined();

			// user2 should still be tracked
			expect(throttling.getLastRequestTime("user2")).toBe(startTime);
		});
	});

	describe("clearAll", () => {
		it("should clear all throttling states", async () => {
			const startTime = Date.now();
			vi.setSystemTime(startTime);

			await throttling.throttle("user1");
			await throttling.throttle("user2");

			expect(throttling.getActiveKeyCount()).toBe(2);

			throttling.clearAll();

			expect(throttling.getActiveKeyCount()).toBe(0);
			expect(throttling.getLastRequestTime("user1")).toBeUndefined();
			expect(throttling.getLastRequestTime("user2")).toBeUndefined();
		});
	});

	describe("getActiveKeyCount", () => {
		it("should return 0 for a new throttling instance", () => {
			expect(throttling.getActiveKeyCount()).toBe(0);
		});

		it("should return the number of active keys", async () => {
			await throttling.throttle("user1");
			expect(throttling.getActiveKeyCount()).toBe(1);

			await throttling.throttle("user2");
			expect(throttling.getActiveKeyCount()).toBe(2);
		});

		it("should decrease when keys are cleared", async () => {
			await throttling.throttle("user1");
			await throttling.throttle("user2");

			expect(throttling.getActiveKeyCount()).toBe(2);

			throttling.clear("user1");
			expect(throttling.getActiveKeyCount()).toBe(1);

			throttling.clearAll();
			expect(throttling.getActiveKeyCount()).toBe(0);
		});
	});

	describe("getLastRequestTime", () => {
		it("should return undefined for a new key", () => {
			expect(throttling.getLastRequestTime("user1")).toBeUndefined();
		});

		it("should return the timestamp of the last request", async () => {
			const startTime = Date.now();
			vi.setSystemTime(startTime);

			await throttling.throttle("user1");
			expect(throttling.getLastRequestTime("user1")).toBe(startTime);
		});

		it("should return undefined after clearing a key", async () => {
			await throttling.throttle("user1");
			expect(throttling.getLastRequestTime("user1")).toBeDefined();

			throttling.clear("user1");
			expect(throttling.getLastRequestTime("user1")).toBeUndefined();
		});
	});

	describe("edge cases", () => {
		it("should handle requests exactly at the interval boundary", async () => {
			const startTime = Date.now();
			vi.setSystemTime(startTime);

			await throttling.throttle("user1");

			// Advance time by exactly the interval
			vi.advanceTimersByTime(minIntervalMs);

			const result = await throttling.throttle("user1");
			expect(result.success).toBe(true);
			expect(result.waitTime).toBe(0);
		});

		it("should handle very long intervals", async () => {
			const longIntervalThrottling = new MemoryThrottling(60000); // 1 minute
			const startTime = Date.now();
			vi.setSystemTime(startTime);

			await longIntervalThrottling.throttle("user1");

			// Advance time by 30 seconds (half the interval)
			vi.advanceTimersByTime(30000);

			const result = await longIntervalThrottling.throttle("user1");
			expect(result.success).toBe(false);
			expect(result.waitTime).toBe(30000);
		});

		it("should handle very short intervals", async () => {
			const shortIntervalThrottling = new MemoryThrottling(10); // 10ms
			const startTime = Date.now();
			vi.setSystemTime(startTime);

			await shortIntervalThrottling.throttle("user1");

			// Advance time by 5ms (half the interval)
			vi.advanceTimersByTime(5);

			const result = await shortIntervalThrottling.throttle("user1");
			expect(result.success).toBe(false);
			expect(result.waitTime).toBe(5);
		});
	});
});
