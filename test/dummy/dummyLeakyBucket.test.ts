import { beforeEach, describe, expect, it } from "vitest";
import { DummyLeakyBucket } from "../../src/dummy/DummyLeakyBucket";

describe("DummyLeakyBucket", () => {
	let dummyRateLimiter: DummyLeakyBucket;

	beforeEach(() => {
		dummyRateLimiter = new DummyLeakyBucket();
	});

	describe("Constructor", () => {
		it("should create a dummy rate limiter without Redis", () => {
			const limiter = new DummyLeakyBucket();
			expect(limiter.getCapacity()).toBe(-1);
		});

		it("should not throw errors during construction", () => {
			expect(() => new DummyLeakyBucket()).not.toThrow();
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

		it("should handle custom request IDs", async () => {
			const result1 = await dummyRateLimiter.consume(
				"custom-id-test",
				"req-123",
			);
			const result2 = await dummyRateLimiter.consume(
				"custom-id-test",
				"req-456",
			);

			expect(result1.success).toBe(true);
			expect(result1.remaining).toBe(-1);
			expect(result2.success).toBe(true);
			expect(result2.remaining).toBe(-1);
		});
	});

	describe("getState()", () => {
		it("should return dummy values for new bucket", async () => {
			const result = await dummyRateLimiter.getState("new-bucket");

			expect(result.size).toBe(-1);
			expect(result.remaining).toBe(-1);
		});

		it("should return same dummy values regardless of previous operations", async () => {
			// Consume some requests
			await dummyRateLimiter.consume("state-test-1");

			// Check state
			const result = await dummyRateLimiter.getState("state-test-1");

			expect(result.size).toBe(-1);
			expect(result.remaining).toBe(-1);
		});

		it("should not be affected by multiple calls", async () => {
			// Check state multiple times
			const result1 = await dummyRateLimiter.getState("state-test-2");
			const result2 = await dummyRateLimiter.getState("state-test-2");
			const result3 = await dummyRateLimiter.getState("state-test-2");

			expect(result1.size).toBe(-1);
			expect(result1.remaining).toBe(-1);
			expect(result2.size).toBe(-1);
			expect(result2.remaining).toBe(-1);
			expect(result3.size).toBe(-1);
			expect(result3.remaining).toBe(-1);
		});

		it("should return consistent values regardless of time", async () => {
			const initialResult = await dummyRateLimiter.getState("time-test");

			// Wait a bit and check again
			await new Promise((resolve) => setTimeout(resolve, 100));

			const laterResult = await dummyRateLimiter.getState("time-test");

			expect(initialResult.size).toBe(-1);
			expect(initialResult.remaining).toBe(-1);
			expect(laterResult.size).toBe(-1);
			expect(laterResult.remaining).toBe(-1);
		});

		it("should handle multiple independent buckets with same dummy values", async () => {
			// Set up different states for different buckets (these should not matter)
			await dummyRateLimiter.consume("bucket-a");
			await dummyRateLimiter.consume("bucket-b");
			await dummyRateLimiter.consume("bucket-c");

			// Check each bucket independently
			const resultA = await dummyRateLimiter.getState("bucket-a");
			const resultB = await dummyRateLimiter.getState("bucket-b");
			const resultC = await dummyRateLimiter.getState("bucket-c");

			expect(resultA.size).toBe(-1);
			expect(resultA.remaining).toBe(-1);
			expect(resultB.size).toBe(-1);
			expect(resultB.remaining).toBe(-1);
			expect(resultC.size).toBe(-1);
			expect(resultC.remaining).toBe(-1);
		});
	});

	describe("getCapacity()", () => {
		it("should return dummy capacity of -1", () => {
			expect(dummyRateLimiter.getCapacity()).toBe(-1);
		});

		it("should consistently return -1 regardless of operations", async () => {
			// Perform various operations
			await dummyRateLimiter.consume("capacity-test");
			await dummyRateLimiter.getState("capacity-test");

			// Capacity should still be -1
			expect(dummyRateLimiter.getCapacity()).toBe(-1);
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
			const stateResult = await dummyRateLimiter.getState(key);
			await dummyRateLimiter.consume(key, "custom-id");

			// All should return dummy values
			expect(stateResult.size).toBe(-1);
			expect(stateResult.remaining).toBe(-1);
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
				const stateResult = await dummyRateLimiter.getState(key);

				expect(consumeResult.success).toBe(true);
				expect(consumeResult.remaining).toBe(-1);
				expect(stateResult.size).toBe(-1);
				expect(stateResult.remaining).toBe(-1);
			}
		});

		it("should never throw errors during normal operations", async () => {
			const operations = [
				() => dummyRateLimiter.consume("error-test"),
				() => dummyRateLimiter.consume("error-test", "custom-id"),
				() => dummyRateLimiter.getState("error-test"),
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

		it("should handle various request ID formats", async () => {
			const requestIds = [
				"simple-id",
				"id:with:colons",
				"id-with-dashes",
				"id_with_underscores",
				"id.with.dots",
				"123numeric456",
				"mixed1:id_2.test-3",
				"", // empty id
				"very-long-request-id-that-might-be-a-uuid-or-something-similar",
			];

			for (const requestId of requestIds) {
				const result = await dummyRateLimiter.consume("id-test", requestId);
				expect(result.success).toBe(true);
				expect(result.remaining).toBe(-1);
			}
		});
	});
});
