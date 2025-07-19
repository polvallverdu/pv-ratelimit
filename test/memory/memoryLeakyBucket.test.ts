import { beforeEach, describe, expect, it } from "bun:test";
import { MemoryLeakyBucket } from "../../src/memory/MemoryLeakyBucket";

describe("MemoryLeakyBucket", () => {
	let rateLimiter: MemoryLeakyBucket;

	beforeEach(() => {
		rateLimiter = new MemoryLeakyBucket(5); // 5 requests capacity
	});

	describe("constructor", () => {
		it("should create a rate limiter with valid parameters", () => {
			expect(rateLimiter.getCapacity()).toBe(5);
		});

		it("should throw error for invalid capacity", () => {
			expect(() => new MemoryLeakyBucket(0)).toThrow(
				"Capacity must be greater than 0",
			);
			expect(() => new MemoryLeakyBucket(-1)).toThrow(
				"Capacity must be greater than 0",
			);
		});

		it("should throw error for invalid cleanup interval", () => {
			expect(() => new MemoryLeakyBucket(5, 0)).toThrow(
				"Cleanup interval must be greater than 0",
			);
			expect(() => new MemoryLeakyBucket(5, -1)).toThrow(
				"Cleanup interval must be greater than 0",
			);
		});
	});

	describe("consume", () => {
		it("should allow requests within capacity", async () => {
			const key = "test-user";

			// First 5 requests should succeed
			for (let i = 0; i < 5; i++) {
				const result = await rateLimiter.consume(key);
				expect(result.success).toBe(true);
				expect(result.remaining).toBe(4 - i);
			}
		});

		it("should reject requests beyond capacity", async () => {
			const key = "test-user";

			// Use up all 5 requests
			for (let i = 0; i < 5; i++) {
				await rateLimiter.consume(key);
			}

			// 6th request should be rejected
			const result = await rateLimiter.consume(key);
			expect(result.success).toBe(false);
			expect(result.remaining).toBe(0);
		});

		it("should handle multiple keys independently", async () => {
			const key1 = "user1";
			const key2 = "user2";

			// Use up all requests for user1
			for (let i = 0; i < 5; i++) {
				await rateLimiter.consume(key1);
			}

			// user2 should still have all requests available
			const result = await rateLimiter.consume(key2);
			expect(result.success).toBe(true);
			expect(result.remaining).toBe(4);
		});

		it("should use provided unique request ID", async () => {
			const key = "test-user";
			const requestId = "custom-request-id";

			const result = await rateLimiter.consume(key, requestId);
			expect(result.success).toBe(true);

			// Check that the request ID was stored
			const requests = rateLimiter.getRequests(key);
			expect(requests).toContain(requestId);
		});

		it("should generate unique request ID when not provided", async () => {
			const key = "test-user";

			const result = await rateLimiter.consume(key);
			expect(result.success).toBe(true);

			// Check that a request ID was generated and stored
			const requests = rateLimiter.getRequests(key);
			expect(requests).toHaveLength(1);
			expect(requests[0]).toMatch(/^\d+-\w+$/); // timestamp-randomstring format
		});
	});

	describe("getState", () => {
		it("should return empty state for new keys", async () => {
			const key = "new-user";
			const state = await rateLimiter.getState(key);
			expect(state.size).toBe(0);
			expect(state.remaining).toBe(5);
		});

		it("should return correct state after requests", async () => {
			const key = "test-user";

			// Make 2 requests
			await rateLimiter.consume(key);
			await rateLimiter.consume(key);

			const state = await rateLimiter.getState(key);
			expect(state.size).toBe(2);
			expect(state.remaining).toBe(3);
		});

		it("should return full state when capacity is reached", async () => {
			const key = "test-user";

			// Use up all requests
			for (let i = 0; i < 5; i++) {
				await rateLimiter.consume(key);
			}

			const state = await rateLimiter.getState(key);
			expect(state.size).toBe(5);
			expect(state.remaining).toBe(0);
		});
	});

	describe("removeRequest", () => {
		it("should remove specific request by ID", async () => {
			const key = "test-user";
			const requestId = "test-request-id";

			// Add a request with specific ID
			await rateLimiter.consume(key, requestId);

			// Verify it was added
			let state = await rateLimiter.getState(key);
			expect(state.size).toBe(1);

			// Remove the request
			const removed = rateLimiter.removeRequest(key, requestId);
			expect(removed).toBe(true);

			// Verify it was removed
			state = await rateLimiter.getState(key);
			expect(state.size).toBe(0);
			expect(state.remaining).toBe(5);
		});

		it("should return false for non-existent request ID", async () => {
			const key = "test-user";

			// Add a request
			await rateLimiter.consume(key);

			// Try to remove non-existent request
			const removed = rateLimiter.removeRequest(key, "non-existent-id");
			expect(removed).toBe(false);

			// State should remain unchanged
			const state = await rateLimiter.getState(key);
			expect(state.size).toBe(1);
		});

		it("should return false for non-existent key", () => {
			const removed = rateLimiter.removeRequest("non-existent-key", "any-id");
			expect(removed).toBe(false);
		});

		it("should allow adding new requests after removal", async () => {
			const key = "test-user";
			const requestId = "test-request-id";

			// Fill the bucket
			for (let i = 0; i < 5; i++) {
				await rateLimiter.consume(key, `request-${i}`);
			}

			// Verify bucket is full
			let state = await rateLimiter.getState(key);
			expect(state.remaining).toBe(0);

			// Remove one request
			rateLimiter.removeRequest(key, "request-0");

			// Should be able to add a new request
			const result = await rateLimiter.consume(key, requestId);
			expect(result.success).toBe(true);
			expect(result.remaining).toBe(0); // Still 5 total, but 1 was removed and 1 added

			// Verify state
			state = await rateLimiter.getState(key);
			expect(state.size).toBe(5);
		});
	});

	describe("utility methods", () => {
		it("should track active key count", async () => {
			expect(rateLimiter.getActiveKeyCount()).toBe(0);

			// Add some keys
			await rateLimiter.consume("user1");
			await rateLimiter.consume("user2");

			expect(rateLimiter.getActiveKeyCount()).toBe(2);
		});

		it("should track total request count", async () => {
			expect(rateLimiter.getTotalRequestCount()).toBe(0);

			// Add requests to multiple keys
			await rateLimiter.consume("user1");
			await rateLimiter.consume("user1");
			await rateLimiter.consume("user2");

			expect(rateLimiter.getTotalRequestCount()).toBe(3);
		});

		it("should clear all data", async () => {
			const key = "test-user";

			// Make some requests
			await rateLimiter.consume(key);
			await rateLimiter.consume(key);

			// Clear all data
			rateLimiter.clear();

			// Should have full capacity available again
			const state = await rateLimiter.getState(key);
			expect(state.size).toBe(0);
			expect(state.remaining).toBe(5);
			expect(rateLimiter.getActiveKeyCount()).toBe(0);
		});

		it("should get requests for a key", async () => {
			const key = "test-user";
			const requestIds = ["req1", "req2", "req3"];

			// Add requests with specific IDs
			for (const requestId of requestIds) {
				await rateLimiter.consume(key, requestId);
			}

			const requests = rateLimiter.getRequests(key);
			expect(requests).toHaveLength(3);
			expect(requests).toEqual(expect.arrayContaining(requestIds));
		});

		it("should return empty array for non-existent key", () => {
			const requests = rateLimiter.getRequests("non-existent-key");
			expect(requests).toEqual([]);
		});

		it("should return copy of requests array", async () => {
			const key = "test-user";
			await rateLimiter.consume(key, "test-id");

			const requests1 = rateLimiter.getRequests(key);
			const requests2 = rateLimiter.getRequests(key);

			// Modifying one array shouldn't affect the other
			requests1.push("modified");
			expect(requests2).toHaveLength(1);
			expect(requests2).not.toContain("modified");
		});
	});

	describe("memory management", () => {
		it("should handle large number of keys", async () => {
			const numKeys = 1000;

			// Create many keys
			for (let i = 0; i < numKeys; i++) {
				await rateLimiter.consume(`user-${i}`);
			}

			expect(rateLimiter.getActiveKeyCount()).toBe(numKeys);
			expect(rateLimiter.getTotalRequestCount()).toBe(numKeys);
		});

		it("should handle large number of requests per key", async () => {
			const key = "test-user";
			const capacity = 1000;
			const largeRateLimiter = new MemoryLeakyBucket(capacity);

			// Fill the bucket
			for (let i = 0; i < capacity; i++) {
				const result = await largeRateLimiter.consume(key);
				expect(result.success).toBe(true);
			}

			// Next request should be rejected
			const result = await largeRateLimiter.consume(key);
			expect(result.success).toBe(false);

			const state = await largeRateLimiter.getState(key);
			expect(state.size).toBe(capacity);
			expect(state.remaining).toBe(0);
		});
	});
});
