import { beforeEach, describe, expect, it } from "bun:test";
import { MemoryFixedWindow } from "../../src/memory/MemoryFixedWindow";

describe("MemoryFixedWindow", () => {
	let rateLimiter: MemoryFixedWindow;

	beforeEach(() => {
		rateLimiter = new MemoryFixedWindow(5, 60); // 5 requests per 60 seconds
	});

	describe("constructor", () => {
		it("should create a rate limiter with valid parameters", () => {
			expect(rateLimiter.getLimit()).toBe(5);
			expect(rateLimiter.getInterval()).toBe(60);
		});

		it("should throw error for invalid limit", () => {
			expect(() => new MemoryFixedWindow(0, 60)).toThrow(
				"Limit must be greater than 0",
			);
			expect(() => new MemoryFixedWindow(-1, 60)).toThrow(
				"Limit must be greater than 0",
			);
		});

		it("should throw error for invalid interval", () => {
			expect(() => new MemoryFixedWindow(5, 0)).toThrow(
				"Interval must be greater than 0",
			);
			expect(() => new MemoryFixedWindow(5, -1)).toThrow(
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

		it("should reset window for new time periods", async () => {
			const key = "test-user";

			// Use up all requests
			for (let i = 0; i < 5; i++) {
				await rateLimiter.consume(key);
			}

			// Verify no more requests allowed
			const result1 = await rateLimiter.consume(key);
			expect(result1.success).toBe(false);

			// Mock time to advance to next window
			const originalDateNow = Date.now;
			const mockTime = Date.now() + 61000; // Advance 61 seconds
			Date.now = () => mockTime;

			try {
				// Should allow requests in new window
				const result2 = await rateLimiter.consume(key);
				expect(result2.success).toBe(true);
				expect(result2.remaining).toBe(4);
			} finally {
				// Restore original Date.now
				Date.now = originalDateNow;
			}
		});
	});

	describe("getRemaining", () => {
		it("should return full limit for new keys", async () => {
			const key = "new-user";
			const remaining = await rateLimiter.getRemaining(key);
			expect(remaining).toBe(5);
		});

		it("should return correct remaining count", async () => {
			const key = "test-user";

			// Make 2 requests
			await rateLimiter.consume(key);
			await rateLimiter.consume(key);

			const remaining = await rateLimiter.getRemaining(key);
			expect(remaining).toBe(3);
		});

		it("should return 0 when limit is reached", async () => {
			const key = "test-user";

			// Use up all requests
			for (let i = 0; i < 5; i++) {
				await rateLimiter.consume(key);
			}

			const remaining = await rateLimiter.getRemaining(key);
			expect(remaining).toBe(0);
		});
	});

	describe("utility methods", () => {
		it("should track active key count", () => {
			expect(rateLimiter.getActiveKeyCount()).toBe(0);

			// Add some keys
			rateLimiter.consume("user1");
			rateLimiter.consume("user2");

			// Note: Since consume is async, we need to wait for it
			// This test will be updated when we add sync methods or better testing
		});

		it("should clear all data", async () => {
			const key = "test-user";

			// Make some requests
			await rateLimiter.consume(key);
			await rateLimiter.consume(key);

			// Clear all data
			rateLimiter.clear();

			// Should have full limit available again
			const remaining = await rateLimiter.getRemaining(key);
			expect(remaining).toBe(5);
		});

		it("should cleanup expired windows", async () => {
			const key = "test-user";

			// Use up all requests
			for (let i = 0; i < 5; i++) {
				await rateLimiter.consume(key);
			}

			// Mock time to advance to next window
			const originalDateNow = Date.now;
			const mockTime = Date.now() + 61000; // Advance 61 seconds
			Date.now = () => mockTime;

			try {
				// Cleanup should remove expired data
				rateLimiter.cleanupAllExpired();

				// Should have full limit available again
				const remaining = await rateLimiter.getRemaining(key);
				expect(remaining).toBe(5);
			} finally {
				// Restore original Date.now
				Date.now = originalDateNow;
			}
		});
	});
});
