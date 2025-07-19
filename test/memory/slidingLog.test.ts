import { beforeEach, describe, expect, it } from "bun:test";
import { MemorySlidingLog } from "../../src/memory/MemorySlidingLog";

describe("MemorySlidingLog", () => {
	let rateLimiter: MemorySlidingLog;

	beforeEach(() => {
		rateLimiter = new MemorySlidingLog(5, 60); // 5 requests per 60 seconds
	});

	describe("constructor", () => {
		it("should create a new instance with valid parameters", () => {
			expect(rateLimiter.getLimit()).toBe(5);
			expect(rateLimiter.getInterval()).toBe(60);
		});

		it("should throw error for invalid limit", () => {
			expect(() => new MemorySlidingLog(0, 60)).toThrow(
				"Limit must be greater than 0",
			);
			expect(() => new MemorySlidingLog(-1, 60)).toThrow(
				"Limit must be greater than 0",
			);
		});

		it("should throw error for invalid interval", () => {
			expect(() => new MemorySlidingLog(5, 0)).toThrow(
				"Interval must be greater than 0",
			);
			expect(() => new MemorySlidingLog(5, -1)).toThrow(
				"Interval must be greater than 0",
			);
		});
	});

	describe("consume", () => {
		it("should allow requests within limit", async () => {
			const key = "test-user";

			// First 5 requests should succeed
			for (let i = 0; i < 5; i++) {
				const result = await rateLimiter.consume(key);
				expect(result.success).toBe(true);
				expect(result.remaining).toBe(4 - i);
			}
		});

		it("should reject requests beyond limit", async () => {
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

		it("should ignore uniqueRequestId parameter", async () => {
			const key = "test-user";
			const result1 = await rateLimiter.consume(key, "req1");
			const result2 = await rateLimiter.consume(key, "req2");

			expect(result1.success).toBe(true);
			expect(result2.success).toBe(true);
			expect(result1.remaining).toBe(4);
			expect(result2.remaining).toBe(3);
		});
	});

	describe("getRemaining", () => {
		it("should return full limit for new keys", async () => {
			const key = "new-user";
			const remaining = await rateLimiter.getRemaining(key);
			expect(remaining).toBe(5);
		});

		it("should return correct remaining count after consumption", async () => {
			const key = "test-user";

			await rateLimiter.consume(key);
			expect(await rateLimiter.getRemaining(key)).toBe(4);

			await rateLimiter.consume(key);
			expect(await rateLimiter.getRemaining(key)).toBe(3);
		});

		it("should return 0 when limit is reached", async () => {
			const key = "test-user";

			// Use up all requests
			for (let i = 0; i < 5; i++) {
				await rateLimiter.consume(key);
			}

			expect(await rateLimiter.getRemaining(key)).toBe(0);
		});
	});

	describe("getLimit and getInterval", () => {
		it("should return correct limit and interval", () => {
			expect(rateLimiter.getLimit()).toBe(5);
			expect(rateLimiter.getInterval()).toBe(60);
		});
	});

	describe("cleanup", () => {
		it("should remove expired entries", () => {
			const key = "test-user";

			// Add some timestamps manually to simulate expired data
			const storage = (rateLimiter as any).storage;
			storage.set(key, [Date.now() / 1000 - 120, Date.now() / 1000 - 90]); // 2 minutes and 1.5 minutes ago

			expect(storage.size).toBe(1);

			rateLimiter.cleanup();

			expect(storage.size).toBe(0);
		});

		it("should keep valid entries after cleanup", () => {
			const key = "test-user";

			// Add mix of expired and valid timestamps
			const storage = (rateLimiter as any).storage;
			const now = Date.now() / 1000;
			storage.set(key, [now - 120, now - 30, now - 10]); // 2min ago, 30s ago, 10s ago

			rateLimiter.cleanup();

			expect(storage.size).toBe(1);
			const remaining = storage.get(key);
			expect(remaining.length).toBe(2); // Only 30s and 10s ago should remain
		});
	});

	describe("getActiveRequests", () => {
		it("should return 0 for new keys", () => {
			const key = "new-user";
			expect(rateLimiter.getActiveRequests(key)).toBe(0);
		});

		it("should return correct count of active requests", () => {
			const key = "test-user";

			// Add mix of expired and valid timestamps
			const storage = (rateLimiter as any).storage;
			const now = Date.now() / 1000;
			storage.set(key, [now - 120, now - 30, now - 10]); // 2min ago, 30s ago, 10s ago

			expect(rateLimiter.getActiveRequests(key)).toBe(2); // Only 30s and 10s ago are active
		});
	});

	describe("clear and clearAll", () => {
		it("should clear specific key", async () => {
			const key1 = "user1";
			const key2 = "user2";

			await rateLimiter.consume(key1);
			await rateLimiter.consume(key2);

			rateLimiter.clear(key1);

			// key1 should be reset
			expect(await rateLimiter.getRemaining(key1)).toBe(5);
			// key2 should remain unchanged
			expect(await rateLimiter.getRemaining(key2)).toBe(4);
		});

		it("should clear all data", async () => {
			const key1 = "user1";
			const key2 = "user2";

			await rateLimiter.consume(key1);
			await rateLimiter.consume(key2);

			rateLimiter.clearAll();

			// Both keys should be reset
			expect(await rateLimiter.getRemaining(key1)).toBe(5);
			expect(await rateLimiter.getRemaining(key2)).toBe(5);
		});
	});

	describe("getKeyCount", () => {
		it("should return 0 for empty storage", () => {
			expect(rateLimiter.getKeyCount()).toBe(0);
		});

		it("should return correct number of keys", async () => {
			await rateLimiter.consume("user1");
			await rateLimiter.consume("user2");

			expect(rateLimiter.getKeyCount()).toBe(2);
		});

		it("should update count after clearing", async () => {
			await rateLimiter.consume("user1");
			await rateLimiter.consume("user2");

			rateLimiter.clear("user1");
			expect(rateLimiter.getKeyCount()).toBe(1);

			rateLimiter.clearAll();
			expect(rateLimiter.getKeyCount()).toBe(0);
		});
	});

	describe("sliding window behavior", () => {
		it("should allow requests after window slides", async () => {
			const key = "test-user";

			// Use up all requests
			for (let i = 0; i < 5; i++) {
				await rateLimiter.consume(key);
			}

			// Should be rejected
			let result = await rateLimiter.consume(key);
			expect(result.success).toBe(false);

			// Simulate time passing by manually adjusting timestamps
			const storage = (rateLimiter as any).storage;
			const timestamps = storage.get(key);
			const now = Date.now() / 1000;

			// Make all timestamps old enough to expire
			for (let i = 0; i < timestamps.length; i++) {
				timestamps[i] = now - 120; // 2 minutes ago
			}

			// Should now be allowed again
			result = await rateLimiter.consume(key);
			expect(result.success).toBe(true);
			expect(result.remaining).toBe(4);
		});
	});
});
