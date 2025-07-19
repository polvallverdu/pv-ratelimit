import { beforeEach, describe, expect, it } from "vitest";
import { DummyThrottling } from "../../src/dummy/DummyThrottling";

describe("DummyThrottling", () => {
	let dummyThrottler: DummyThrottling;

	beforeEach(() => {
		dummyThrottler = new DummyThrottling();
	});

	describe("Constructor", () => {
		it("should create a dummy throttler without Redis", () => {
			const throttler = new DummyThrottling();
			expect(throttler.getMinInterval()).toBe(-1);
			expect(throttler.getMinIntervalSeconds()).toBe(-1);
		});

		it("should not throw errors during construction", () => {
			expect(() => new DummyThrottling()).not.toThrow();
		});
	});

	describe("throttle()", () => {
		it("should always return success with no wait time", async () => {
			const result = await dummyThrottler.throttle("test-key-1");

			expect(result.success).toBe(true);
			expect(result.waitTime).toBe(0);
			expect(result.nextAllowedAt).toBeGreaterThan(0);
		});

		it("should always succeed even with multiple calls", async () => {
			const result1 = await dummyThrottler.throttle("test-key-2");
			const result2 = await dummyThrottler.throttle("test-key-2");
			const result3 = await dummyThrottler.throttle("test-key-2");

			expect(result1.success).toBe(true);
			expect(result1.waitTime).toBe(0);
			expect(result2.success).toBe(true);
			expect(result2.waitTime).toBe(0);
			expect(result3.success).toBe(true);
			expect(result3.waitTime).toBe(0);
		});

		it("should handle multiple different keys with same dummy behavior", async () => {
			const result1 = await dummyThrottler.throttle("user-1");
			const result2 = await dummyThrottler.throttle("user-2");

			expect(result1.success).toBe(true);
			expect(result1.waitTime).toBe(0);
			expect(result2.success).toBe(true);
			expect(result2.waitTime).toBe(0);
		});

		it("should always succeed for consecutive calls on same key", async () => {
			// Multiple calls to the same key should all succeed
			const calls = [];
			for (let i = 0; i < 10; i++) {
				calls.push(dummyThrottler.throttle("same-key"));
			}

			const results = await Promise.all(calls);

			results.forEach((result) => {
				expect(result.success).toBe(true);
				expect(result.waitTime).toBe(0);
			});
		});

		it("should return current timestamp as nextAllowedAt", async () => {
			const beforeCall = Date.now();
			const result = await dummyThrottler.throttle("timestamp-test");
			const afterCall = Date.now();

			expect(result.success).toBe(true);
			expect(result.nextAllowedAt).toBeGreaterThanOrEqual(beforeCall);
			expect(result.nextAllowedAt).toBeLessThanOrEqual(afterCall);
		});
	});

	describe("getStatus()", () => {
		it("should return dummy values for new key", async () => {
			const result = await dummyThrottler.getStatus("new-key");

			expect(result.success).toBe(true);
			expect(result.waitTime).toBe(0);
			expect(result.nextAllowedAt).toBeGreaterThan(0);
		});

		it("should return same dummy values regardless of previous operations", async () => {
			// Throttle some requests
			await dummyThrottler.throttle("status-test-1");

			// Check status
			const result = await dummyThrottler.getStatus("status-test-1");

			expect(result.success).toBe(true);
			expect(result.waitTime).toBe(0);
		});

		it("should not be affected by multiple calls", async () => {
			// Check status multiple times
			const result1 = await dummyThrottler.getStatus("status-test-2");
			const result2 = await dummyThrottler.getStatus("status-test-2");
			const result3 = await dummyThrottler.getStatus("status-test-2");

			expect(result1.success).toBe(true);
			expect(result1.waitTime).toBe(0);
			expect(result2.success).toBe(true);
			expect(result2.waitTime).toBe(0);
			expect(result3.success).toBe(true);
			expect(result3.waitTime).toBe(0);
		});

		it("should return consistent values regardless of time", async () => {
			const initialResult = await dummyThrottler.getStatus("time-test");

			// Wait a bit and check again
			await new Promise((resolve) => setTimeout(resolve, 100));

			const laterResult = await dummyThrottler.getStatus("time-test");

			expect(initialResult.success).toBe(true);
			expect(initialResult.waitTime).toBe(0);
			expect(laterResult.success).toBe(true);
			expect(laterResult.waitTime).toBe(0);
		});

		it("should handle multiple independent keys with same dummy values", async () => {
			// Set up different states for different keys (these should not matter)
			await dummyThrottler.throttle("key-a");
			await dummyThrottler.throttle("key-b");
			await dummyThrottler.throttle("key-c");

			// Check each key independently
			const resultA = await dummyThrottler.getStatus("key-a");
			const resultB = await dummyThrottler.getStatus("key-b");
			const resultC = await dummyThrottler.getStatus("key-c");

			expect(resultA.success).toBe(true);
			expect(resultA.waitTime).toBe(0);
			expect(resultB.success).toBe(true);
			expect(resultB.waitTime).toBe(0);
			expect(resultC.success).toBe(true);
			expect(resultC.waitTime).toBe(0);
		});
	});

	describe("getMinInterval()", () => {
		it("should return dummy interval of -1", () => {
			expect(dummyThrottler.getMinInterval()).toBe(-1);
		});

		it("should consistently return -1 regardless of operations", async () => {
			// Perform various operations
			await dummyThrottler.throttle("interval-test");
			await dummyThrottler.getStatus("interval-test");

			// Interval should still be -1
			expect(dummyThrottler.getMinInterval()).toBe(-1);
		});
	});

	describe("getMinIntervalSeconds()", () => {
		it("should return dummy interval seconds of -1", () => {
			expect(dummyThrottler.getMinIntervalSeconds()).toBe(-1);
		});

		it("should consistently return -1 regardless of operations", async () => {
			// Perform various operations
			await dummyThrottler.throttle("interval-seconds-test");
			await dummyThrottler.getStatus("interval-seconds-test");

			// Interval seconds should still be -1
			expect(dummyThrottler.getMinIntervalSeconds()).toBe(-1);
		});
	});

	describe("Edge cases and integration", () => {
		it("should handle rapid consecutive operations consistently", async () => {
			const operations = [];

			// Launch multiple operations simultaneously
			for (let i = 0; i < 10; i++) {
				operations.push(dummyThrottler.throttle("concurrent-test"));
			}

			const results = await Promise.all(operations);

			// All should succeed with no wait time
			results.forEach((result) => {
				expect(result.success).toBe(true);
				expect(result.waitTime).toBe(0);
			});
		});

		it("should handle mixed operations in sequence", async () => {
			const key = "mixed-test";

			// Mix of different operations
			await dummyThrottler.throttle(key);
			const statusResult = await dummyThrottler.getStatus(key);
			await dummyThrottler.throttle(key);

			// All should return dummy values
			expect(statusResult.success).toBe(true);
			expect(statusResult.waitTime).toBe(0);
		});

		it("should maintain dummy behavior regardless of key format", async () => {
			const keys = [
				"simple-key",
				"key:with:colons",
				"key-with-dashes",
				"key_with_underscores",
				"key.with.dots",
				"123numeric456",
				"mixed1:key_2.test-3",
				"", // empty key
			];

			for (const key of keys) {
				const throttleResult = await dummyThrottler.throttle(key);
				const statusResult = await dummyThrottler.getStatus(key);

				expect(throttleResult.success).toBe(true);
				expect(throttleResult.waitTime).toBe(0);
				expect(statusResult.success).toBe(true);
				expect(statusResult.waitTime).toBe(0);
			}
		});

		it("should never throw errors during normal operations", async () => {
			const operations = [
				() => dummyThrottler.throttle("error-test"),
				() => dummyThrottler.getStatus("error-test"),
			];

			for (const operation of operations) {
				await expect(operation()).resolves.not.toThrow();
			}
		});

		it("should behave as disabled throttler", async () => {
			// In a real scenario, this would be throttled, but dummy should allow everything
			const heavyUsageResults = [];

			for (let i = 0; i < 100; i++) {
				heavyUsageResults.push(await dummyThrottler.throttle("heavy-user"));
			}

			// All requests should succeed immediately
			heavyUsageResults.forEach((result) => {
				expect(result.success).toBe(true);
				expect(result.waitTime).toBe(0);
			});
		});

		it("should return consistent nextAllowedAt timestamps", async () => {
			const results = [];
			for (let i = 0; i < 5; i++) {
				results.push(await dummyThrottler.throttle("timestamp-consistency"));
			}

			// All should have valid timestamps
			results.forEach((result) => {
				expect(result.nextAllowedAt).toBeGreaterThan(0);
				expect(typeof result.nextAllowedAt).toBe("number");
			});
		});
	});
});
