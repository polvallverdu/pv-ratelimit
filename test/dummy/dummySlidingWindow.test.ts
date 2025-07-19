import { beforeEach, describe, expect, it } from "vitest";
import { DummySlidingWindow } from "../../src/dummy/DummySlidingWindow";

describe("DummySlidingWindow", () => {
	let dummyRateLimiter: DummySlidingWindow;

	beforeEach(() => {
		dummyRateLimiter = new DummySlidingWindow();
	});

	describe("Constructor", () => {
		it("should create a dummy rate limiter without Redis", () => {
			const limiter = new DummySlidingWindow();
			expect(limiter.getLimit()).toBe(-1);
			expect(limiter.getInterval()).toBe(-1);
		});

		it("should not throw errors during construction", () => {
			expect(() => new DummySlidingWindow()).not.toThrow();
		});
	});

	describe("consume()", () => {
		it("should always return success with dummy values", async () => {
			const result = await dummyRateLimiter.consume("test-key-1");

			expect(result.success).toBe(true);
			expect(result.remaining).toBe(-1);
		});

		it("should always succeed even with multiple calls", async () => {
			const result1 = await dummyRateLimiter.consume("test-key-2");
			const result2 = await dummyRateLimiter.consume("test-key-2");
			const result3 = await dummyRateLimiter.consume("test-key-2");

			expect(result1.success).toBe(true);
			expect(result1.remaining).toBe(-1);
			expect(result2.success).toBe(true);
			expect(result2.remaining).toBe(-1);
			expect(result3.success).toBe(true);
			expect(result3.remaining).toBe(-1);
		});

		it("should handle multiple different keys with same dummy behavior", async () => {
			const result1 = await dummyRateLimiter.consume("user-1");
			const result2 = await dummyRateLimiter.consume("user-2");

			expect(result1.success).toBe(true);
			expect(result1.remaining).toBe(-1);
			expect(result2.success).toBe(true);
			expect(result2.remaining).toBe(-1);
		});

		it("should always succeed for consecutive calls on same key", async () => {
			// Multiple calls to the same key should all succeed
			const calls = [];
			for (let i = 0; i < 10; i++) {
				calls.push(dummyRateLimiter.consume("same-key"));
			}

			const results = await Promise.all(calls);

			results.forEach((result) => {
				expect(result.success).toBe(true);
				expect(result.remaining).toBe(-1);
			});
		});
	});

	describe("getRemaining()", () => {
		it("should return dummy values for new key", async () => {
			const result = await dummyRateLimiter.getRemaining("new-key");

			expect(result).toBe(-1);
		});

		it("should return same dummy values regardless of previous operations", async () => {
			// Consume some requests
			await dummyRateLimiter.consume("count-test-1");

			// Check remaining requests
			const result = await dummyRateLimiter.getRemaining("count-test-1");

			expect(result).toBe(-1);
		});

		it("should not be affected by multiple calls", async () => {
			// Check remaining multiple times
			const result1 = await dummyRateLimiter.getRemaining("count-test-2");
			const result2 = await dummyRateLimiter.getRemaining("count-test-2");
			const result3 = await dummyRateLimiter.getRemaining("count-test-2");

			expect(result1).toBe(-1);
			expect(result2).toBe(-1);
			expect(result3).toBe(-1);
		});

		it("should return consistent values regardless of time", async () => {
			const initialResult = await dummyRateLimiter.getRemaining("time-test");

			// Wait a bit and check again
			await new Promise((resolve) => setTimeout(resolve, 100));

			const laterResult = await dummyRateLimiter.getRemaining("time-test");

			expect(initialResult).toBe(-1);
			expect(laterResult).toBe(-1);
		});

		it("should handle multiple independent keys with same dummy values", async () => {
			// Set up different states for different keys (these should not matter)
			await dummyRateLimiter.consume("key-a");
			await dummyRateLimiter.consume("key-b");
			await dummyRateLimiter.consume("key-c");

			// Check each key independently
			const resultA = await dummyRateLimiter.getRemaining("key-a");
			const resultB = await dummyRateLimiter.getRemaining("key-b");
			const resultC = await dummyRateLimiter.getRemaining("key-c");

			expect(resultA).toBe(-1);
			expect(resultB).toBe(-1);
			expect(resultC).toBe(-1);
		});
	});

	describe("getLimit()", () => {
		it("should return dummy limit of -1", () => {
			expect(dummyRateLimiter.getLimit()).toBe(-1);
		});

		it("should consistently return -1 regardless of operations", async () => {
			// Perform various operations
			await dummyRateLimiter.consume("limit-test");
			await dummyRateLimiter.getRemaining("limit-test");

			// Limit should still be -1
			expect(dummyRateLimiter.getLimit()).toBe(-1);
		});
	});

	describe("getInterval()", () => {
		it("should return dummy interval of -1", () => {
			expect(dummyRateLimiter.getInterval()).toBe(-1);
		});

		it("should consistently return -1 regardless of operations", async () => {
			// Perform various operations
			await dummyRateLimiter.consume("interval-test");
			await dummyRateLimiter.getRemaining("interval-test");

			// Interval should still be -1
			expect(dummyRateLimiter.getInterval()).toBe(-1);
		});
	});

	describe("Edge cases and integration", () => {
		it("should handle rapid consecutive operations consistently", async () => {
			const operations = [];

			// Launch multiple operations simultaneously
			for (let i = 0; i < 10; i++) {
				operations.push(dummyRateLimiter.consume("concurrent-test"));
			}

			const results = await Promise.all(operations);

			// All should succeed with dummy values
			results.forEach((result) => {
				expect(result.success).toBe(true);
				expect(result.remaining).toBe(-1);
			});
		});

		it("should handle mixed operations in sequence", async () => {
			const key = "mixed-test";

			// Mix of different operations
			await dummyRateLimiter.consume(key);
			const getResult = await dummyRateLimiter.getRemaining(key);
			await dummyRateLimiter.consume(key);

			// All should return dummy values
			expect(getResult).toBe(-1);
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
				const consumeResult = await dummyRateLimiter.consume(key);
				const getResult = await dummyRateLimiter.getRemaining(key);

				expect(consumeResult.success).toBe(true);
				expect(consumeResult.remaining).toBe(-1);
				expect(getResult).toBe(-1);
			}
		});

		it("should never throw errors during normal operations", async () => {
			const operations = [
				() => dummyRateLimiter.consume("error-test"),
				() => dummyRateLimiter.getRemaining("error-test"),
			];

			for (const operation of operations) {
				await expect(operation()).resolves.not.toThrow();
			}
		});

		it("should behave as disabled rate limiter", async () => {
			// In a real scenario, this would be rate limited, but dummy should allow everything
			const heavyUsageResults = [];

			for (let i = 0; i < 100; i++) {
				heavyUsageResults.push(await dummyRateLimiter.consume("heavy-user"));
			}

			// All requests should succeed
			heavyUsageResults.forEach((result) => {
				expect(result.success).toBe(true);
				expect(result.remaining).toBe(-1);
			});
		});
	});
});
