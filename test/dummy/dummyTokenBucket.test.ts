import { beforeEach, describe, expect, it } from "vitest";
import { DummyTokenBucket } from "../../src/dummy/DummyTokenBucket";

describe("DummyTokenBucket", () => {
	let dummyRateLimiter: DummyTokenBucket;

	beforeEach(() => {
		dummyRateLimiter = new DummyTokenBucket();
	});

	describe("Constructor", () => {
		it("should create a dummy rate limiter without Redis", () => {
			const limiter = new DummyTokenBucket();
			expect(limiter.getCapacity()).toBe(-1);
		});

		it("should not throw errors during construction", () => {
			expect(() => new DummyTokenBucket()).not.toThrow();
		});
	});

	describe("consume()", () => {
		it("should always return success with dummy values", async () => {
			const result = await dummyRateLimiter.consume("test-key-1", 3);

			expect(result.success).toBe(true);
			expect(result.remainingTokens).toBe(-1);
			expect(result.nextRefillAt).toBe(-1);
		});

		it("should return success for single token consumption by default", async () => {
			const result = await dummyRateLimiter.consume("test-key-2");

			expect(result.success).toBe(true);
			expect(result.remainingTokens).toBe(-1);
			expect(result.nextRefillAt).toBe(-1);
		});

		it("should always succeed even with large token requests", async () => {
			const result = await dummyRateLimiter.consume("test-key-3", 1000000);

			expect(result.success).toBe(true);
			expect(result.remainingTokens).toBe(-1);
			expect(result.nextRefillAt).toBe(-1);
		});

		it("should always succeed with zero token consumption", async () => {
			const result = await dummyRateLimiter.consume("test-key-4", 0);

			expect(result.success).toBe(true);
			expect(result.remainingTokens).toBe(-1);
			expect(result.nextRefillAt).toBe(-1);
		});

		it("should handle multiple different keys with same dummy behavior", async () => {
			const result1 = await dummyRateLimiter.consume("user-1", 5);
			const result2 = await dummyRateLimiter.consume("user-2", 3);

			expect(result1.success).toBe(true);
			expect(result1.remainingTokens).toBe(-1);
			expect(result1.nextRefillAt).toBe(-1);

			expect(result2.success).toBe(true);
			expect(result2.remainingTokens).toBe(-1);
			expect(result2.nextRefillAt).toBe(-1);
		});

		it("should always succeed for consecutive calls on same key", async () => {
			// Multiple calls to the same key should all succeed
			const calls = [];
			for (let i = 0; i < 10; i++) {
				calls.push(dummyRateLimiter.consume("same-key", 5));
			}

			const results = await Promise.all(calls);

			results.forEach((result) => {
				expect(result.success).toBe(true);
				expect(result.remainingTokens).toBe(-1);
				expect(result.nextRefillAt).toBe(-1);
			});
		});

		it("should handle negative token requests", async () => {
			const result = await dummyRateLimiter.consume("test-key-negative", -5);

			expect(result.success).toBe(true);
			expect(result.remainingTokens).toBe(-1);
			expect(result.nextRefillAt).toBe(-1);
		});
	});

	describe("getRemainingTokens()", () => {
		it("should return dummy values for new bucket", async () => {
			const result = await dummyRateLimiter.getRemainingTokens("new-bucket");

			expect(result.remainingTokens).toBe(-1);
			expect(result.nextRefillAt).toBe(1);
		});

		it("should return same dummy values regardless of previous operations", async () => {
			// Consume some tokens
			await dummyRateLimiter.consume("count-test-1", 3);

			// Check remaining tokens
			const result = await dummyRateLimiter.getRemainingTokens("count-test-1");

			expect(result.remainingTokens).toBe(-1);
			expect(result.nextRefillAt).toBe(1);
		});

		it("should not be affected by multiple calls", async () => {
			// Check tokens multiple times
			const result1 = await dummyRateLimiter.getRemainingTokens("count-test-2");
			const result2 = await dummyRateLimiter.getRemainingTokens("count-test-2");
			const result3 = await dummyRateLimiter.getRemainingTokens("count-test-2");

			expect(result1.remainingTokens).toBe(-1);
			expect(result1.nextRefillAt).toBe(1);
			expect(result2.remainingTokens).toBe(-1);
			expect(result2.nextRefillAt).toBe(1);
			expect(result3.remainingTokens).toBe(-1);
			expect(result3.nextRefillAt).toBe(1);
		});

		it("should return consistent values regardless of time", async () => {
			const initialResult =
				await dummyRateLimiter.getRemainingTokens("time-test");

			// Wait a bit and check again
			await new Promise((resolve) => setTimeout(resolve, 100));

			const laterResult =
				await dummyRateLimiter.getRemainingTokens("time-test");

			expect(initialResult.remainingTokens).toBe(-1);
			expect(initialResult.nextRefillAt).toBe(1);
			expect(laterResult.remainingTokens).toBe(-1);
			expect(laterResult.nextRefillAt).toBe(1);
		});

		it("should handle multiple independent buckets with same dummy values", async () => {
			// Set up different states for different buckets (these should not matter)
			await dummyRateLimiter.consume("bucket-a", 2);
			await dummyRateLimiter.consume("bucket-b", 5);
			await dummyRateLimiter.consume("bucket-c", 8);

			// Check each bucket independently
			const resultA = await dummyRateLimiter.getRemainingTokens("bucket-a");
			const resultB = await dummyRateLimiter.getRemainingTokens("bucket-b");
			const resultC = await dummyRateLimiter.getRemainingTokens("bucket-c");

			expect(resultA.remainingTokens).toBe(-1);
			expect(resultA.nextRefillAt).toBe(1);
			expect(resultB.remainingTokens).toBe(-1);
			expect(resultB.nextRefillAt).toBe(1);
			expect(resultC.remainingTokens).toBe(-1);
			expect(resultC.nextRefillAt).toBe(1);
		});
	});

	describe("addTokens()", () => {
		it("should be a no-op and not affect subsequent operations", async () => {
			// Add tokens
			await dummyRateLimiter.addTokens("add-test-1", 3);

			// Check that it didn't change anything
			const result = await dummyRateLimiter.consume("add-test-1", 8);
			expect(result.success).toBe(true);
			expect(result.remainingTokens).toBe(-1);
			expect(result.nextRefillAt).toBe(-1);
		});

		it("should handle zero token addition", async () => {
			await dummyRateLimiter.addTokens("add-test-2", 0);

			const result = await dummyRateLimiter.consume("add-test-2", 1);
			expect(result.success).toBe(true);
			expect(result.remainingTokens).toBe(-1);
		});

		it("should handle negative token addition", async () => {
			await dummyRateLimiter.addTokens("add-test-3", -5);

			const result = await dummyRateLimiter.consume("add-test-3", 1);
			expect(result.success).toBe(true);
			expect(result.remainingTokens).toBe(-1);
		});

		it("should handle large token additions", async () => {
			await dummyRateLimiter.addTokens("add-test-4", 1000000);

			const result = await dummyRateLimiter.getRemainingTokens("add-test-4");
			expect(result.remainingTokens).toBe(-1);
			expect(result.nextRefillAt).toBe(1);
		});
	});

	describe("removeTokens()", () => {
		it("should be a no-op and not affect subsequent operations", async () => {
			// Remove tokens
			await dummyRateLimiter.removeTokens("remove-test-1", 3);

			// Check that it didn't change anything
			const result = await dummyRateLimiter.consume("remove-test-1", 8);
			expect(result.success).toBe(true);
			expect(result.remainingTokens).toBe(-1);
			expect(result.nextRefillAt).toBe(-1);
		});

		it("should handle zero token removal", async () => {
			await dummyRateLimiter.removeTokens("remove-test-2", 0);

			const result = await dummyRateLimiter.consume("remove-test-2", 1);
			expect(result.success).toBe(true);
			expect(result.remainingTokens).toBe(-1);
		});

		it("should handle negative token removal", async () => {
			await dummyRateLimiter.removeTokens("remove-test-3", -5);

			const result = await dummyRateLimiter.consume("remove-test-3", 1);
			expect(result.success).toBe(true);
			expect(result.remainingTokens).toBe(-1);
		});

		it("should handle large token removals", async () => {
			await dummyRateLimiter.removeTokens("remove-test-4", 1000000);

			const result = await dummyRateLimiter.getRemainingTokens("remove-test-4");
			expect(result.remainingTokens).toBe(-1);
			expect(result.nextRefillAt).toBe(1);
		});
	});

	describe("getCapacity()", () => {
		it("should return dummy capacity of -1", () => {
			expect(dummyRateLimiter.getCapacity()).toBe(-1);
		});

		it("should consistently return -1 regardless of operations", async () => {
			// Perform various operations
			await dummyRateLimiter.consume("capacity-test", 5);
			await dummyRateLimiter.addTokens("capacity-test", 10);
			await dummyRateLimiter.removeTokens("capacity-test", 3);

			// Capacity should still be -1
			expect(dummyRateLimiter.getCapacity()).toBe(-1);
		});
	});

	describe("Edge cases and integration", () => {
		it("should handle rapid consecutive operations consistently", async () => {
			const operations = [];

			// Launch multiple operations simultaneously
			for (let i = 0; i < 10; i++) {
				operations.push(dummyRateLimiter.consume("concurrent-test", 2));
			}

			const results = await Promise.all(operations);

			// All should succeed with dummy values
			results.forEach((result) => {
				expect(result.success).toBe(true);
				expect(result.remainingTokens).toBe(-1);
				expect(result.nextRefillAt).toBe(-1);
			});
		});

		it("should handle mixed operations in sequence", async () => {
			const key = "mixed-test";

			// Mix of different operations
			await dummyRateLimiter.consume(key, 5);
			await dummyRateLimiter.addTokens(key, 10);
			const getResult = await dummyRateLimiter.getRemainingTokens(key);
			await dummyRateLimiter.removeTokens(key, 3);
			const consumeResult = await dummyRateLimiter.consume(key, 100);

			// All should return dummy values
			expect(getResult.remainingTokens).toBe(-1);
			expect(getResult.nextRefillAt).toBe(1);
			expect(consumeResult.success).toBe(true);
			expect(consumeResult.remainingTokens).toBe(-1);
			expect(consumeResult.nextRefillAt).toBe(-1);
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
				const consumeResult = await dummyRateLimiter.consume(key, 1);
				const getResult = await dummyRateLimiter.getRemainingTokens(key);

				expect(consumeResult.success).toBe(true);
				expect(consumeResult.remainingTokens).toBe(-1);
				expect(consumeResult.nextRefillAt).toBe(-1);
				expect(getResult.remainingTokens).toBe(-1);
				expect(getResult.nextRefillAt).toBe(1);
			}
		});

		it("should never throw errors during normal operations", async () => {
			const operations = [
				() => dummyRateLimiter.consume("error-test", 1),
				() => dummyRateLimiter.consume("error-test", 0),
				() => dummyRateLimiter.consume("error-test", -1),
				() => dummyRateLimiter.consume("error-test", 999999),
				() => dummyRateLimiter.getRemainingTokens("error-test"),
				() => dummyRateLimiter.addTokens("error-test", 1),
				() => dummyRateLimiter.addTokens("error-test", 0),
				() => dummyRateLimiter.addTokens("error-test", -1),
				() => dummyRateLimiter.removeTokens("error-test", 1),
				() => dummyRateLimiter.removeTokens("error-test", 0),
				() => dummyRateLimiter.removeTokens("error-test", -1),
			];

			for (const operation of operations) {
				await expect(operation()).resolves.not.toThrow();
			}
		});

		it("should behave as disabled rate limiter", async () => {
			// In a real scenario, this would be rate limited, but dummy should allow everything
			const heavyUsageResults = [];

			for (let i = 0; i < 100; i++) {
				heavyUsageResults.push(
					await dummyRateLimiter.consume("heavy-user", 10),
				);
			}

			// All requests should succeed
			heavyUsageResults.forEach((result) => {
				expect(result.success).toBe(true);
				expect(result.remainingTokens).toBe(-1);
				expect(result.nextRefillAt).toBe(-1);
			});
		});
	});
});
