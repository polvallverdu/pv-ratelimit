import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemorySlidingWindow } from "../../src/memory/MemorySlidingWindow";

describe("MemorySlidingWindow", () => {
	let rateLimiter: MemorySlidingWindow;
	const limit = 10;
	const interval = 60; // 60 seconds

	beforeEach(() => {
		rateLimiter = new MemorySlidingWindow(limit, interval);
	});

	describe("constructor", () => {
		it("should create a rate limiter with valid parameters", () => {
			expect(rateLimiter.getLimit()).toBe(limit);
			expect(rateLimiter.getInterval()).toBe(interval);
		});

		it("should throw error for invalid limit", () => {
			expect(() => new MemorySlidingWindow(0, interval)).toThrow(
				"Limit must be greater than 0",
			);
			expect(() => new MemorySlidingWindow(-1, interval)).toThrow(
				"Limit must be greater than 0",
			);
		});

		it("should throw error for invalid interval", () => {
			expect(() => new MemorySlidingWindow(limit, 0)).toThrow(
				"Interval must be greater than 0",
			);
			expect(() => new MemorySlidingWindow(limit, -1)).toThrow(
				"Interval must be greater than 0",
			);
		});
	});

	describe("consume", () => {
		it("should allow requests within limit", async () => {
			for (let i = 0; i < limit; i++) {
				const result = await rateLimiter.consume("user1");
				expect(result.success).toBe(true);
				expect(result.remaining).toBe(limit - i - 1);
			}
		});

		it("should reject requests when limit is exceeded", async () => {
			// Fill up the limit
			for (let i = 0; i < limit; i++) {
				await rateLimiter.consume("user1");
			}

			// Next request should be rejected
			const result = await rateLimiter.consume("user1");
			expect(result.success).toBe(false);
			expect(result.remaining).toBe(0);
		});

		it("should handle multiple keys independently", async () => {
			// Fill up user1
			for (let i = 0; i < limit; i++) {
				await rateLimiter.consume("user1");
			}

			// user2 should still have full limit
			const result = await rateLimiter.consume("user2");
			expect(result.success).toBe(true);
			expect(result.remaining).toBe(limit - 1);
		});

		it("should handle weighted calculation correctly", async () => {
			// Fill up the current window
			for (let i = 0; i < limit; i++) {
				await rateLimiter.consume("user1");
			}

			// Mock time to move to next window
			const originalDateNow = Date.now;
			const mockTime = Date.now() + interval * 1000 + 1000; // Move to next window + 1 second
			Date.now = vi.fn(() => mockTime);

			try {
				// Should allow some requests due to weighted calculation
				const result = await rateLimiter.consume("user1");
				expect(result.success).toBe(true);
				// The remaining should be less than the full limit due to weighted calculation
				expect(result.remaining).toBeLessThan(limit - 1);
			} finally {
				Date.now = originalDateNow;
			}
		});
	});

	describe("getRemaining", () => {
		it("should return full limit for new keys", async () => {
			const remaining = await rateLimiter.getRemaining("newuser");
			expect(remaining).toBe(limit);
		});

		it("should return correct remaining count", async () => {
			await rateLimiter.consume("user1");
			await rateLimiter.consume("user1");

			const remaining = await rateLimiter.getRemaining("user1");
			expect(remaining).toBe(limit - 2);
		});

		it("should return 0 when limit is exceeded", async () => {
			// Fill up the limit
			for (let i = 0; i < limit; i++) {
				await rateLimiter.consume("user1");
			}

			const remaining = await rateLimiter.getRemaining("user1");
			expect(remaining).toBe(0);
		});

		it("should handle window transitions correctly", async () => {
			// Fill up the current window
			for (let i = 0; i < limit; i++) {
				await rateLimiter.consume("user1");
			}

			// Mock time to move to next window
			const originalDateNow = Date.now;
			const mockTime = Date.now() + interval * 1000 + 1000;
			Date.now = vi.fn(() => mockTime);

			try {
				const remaining = await rateLimiter.getRemaining("user1");
				// Should have some remaining due to weighted calculation
				expect(remaining).toBeGreaterThan(0);
				expect(remaining).toBeLessThan(limit);
			} finally {
				Date.now = originalDateNow;
			}
		});
	});

	describe("window transitions", () => {
		it("should handle window transitions correctly", async () => {
			// Fill up current window
			for (let i = 0; i < 5; i++) {
				await rateLimiter.consume("user1");
			}

			// Mock time to move to next window
			const originalDateNow = Date.now;
			const mockTime = Date.now() + interval * 1000 + 1000;
			Date.now = vi.fn(() => mockTime);

			try {
				// Should allow more requests in new window
				const result = await rateLimiter.consume("user1");
				expect(result.success).toBe(true);
			} finally {
				Date.now = originalDateNow;
			}
		});

		it("should preserve previous window data during transitions", async () => {
			// Fill up current window
			for (let i = 0; i < limit; i++) {
				await rateLimiter.consume("user1");
			}

			// Mock time to move to next window
			const originalDateNow = Date.now;
			const mockTime = Date.now() + interval * 1000 + 1000;
			Date.now = jest.fn(() => mockTime);

			try {
				// Check that previous window data is preserved
				const windowState = rateLimiter.getWindowState("user1");
				expect(windowState?.previous).toBe(limit);
				expect(windowState?.current).toBe(0);
			} finally {
				Date.now = originalDateNow;
			}
		});
	});

	describe("cleanup", () => {
		it("should clean up expired window data", () => {
			// Create some window data
			rateLimiter.consume("user1");
			rateLimiter.consume("user2");

			expect(rateLimiter.getWindowCount()).toBe(2);

			// Mock time to move far into the future
			const originalDateNow = Date.now;
			const mockTime = Date.now() + interval * 3 * 1000; // 3 intervals later
			Date.now = jest.fn(() => mockTime);

			try {
				rateLimiter.cleanup();
				expect(rateLimiter.getWindowCount()).toBe(0);
			} finally {
				Date.now = originalDateNow;
			}
		});

		it("should not clean up recent window data", () => {
			// Create some window data
			rateLimiter.consume("user1");
			rateLimiter.consume("user2");

			expect(rateLimiter.getWindowCount()).toBe(2);

			// Mock time to move just one interval later
			const originalDateNow = Date.now;
			const mockTime = Date.now() + interval * 1000 + 1000;
			Date.now = jest.fn(() => mockTime);

			try {
				rateLimiter.cleanup();
				expect(rateLimiter.getWindowCount()).toBe(2);
			} finally {
				Date.now = originalDateNow;
			}
		});
	});

	describe("edge cases", () => {
		it("should handle rapid successive calls", async () => {
			const promises = [];
			for (let i = 0; i < limit + 5; i++) {
				promises.push(rateLimiter.consume("user1"));
			}

			const results = await Promise.all(promises);
			const successful = results.filter((r) => r.success).length;
			const failed = results.filter((r) => !r.success).length;

			expect(successful).toBe(limit);
			expect(failed).toBe(5);
		});

		it("should handle empty keys", async () => {
			const result = await rateLimiter.consume("");
			expect(result.success).toBe(true);
			expect(result.remaining).toBe(limit - 1);
		});

		it("should handle special characters in keys", async () => {
			const specialKey = "user@example.com:123";
			const result = await rateLimiter.consume(specialKey);
			expect(result.success).toBe(true);
			expect(result.remaining).toBe(limit - 1);
		});
	});

	describe("getWindowState", () => {
		it("should return undefined for non-existent keys", () => {
			const state = rateLimiter.getWindowState("nonexistent");
			expect(state).toBeUndefined();
		});

		it("should return window state for existing keys", async () => {
			await rateLimiter.consume("user1");
			await rateLimiter.consume("user1");

			const state = rateLimiter.getWindowState("user1");
			expect(state).toBeDefined();
			expect(state?.current).toBe(2);
			expect(state?.previous).toBe(0);
		});
	});

	describe("getWindowCount", () => {
		it("should return 0 for empty rate limiter", () => {
			expect(rateLimiter.getWindowCount()).toBe(0);
		});

		it("should return correct count after adding keys", async () => {
			await rateLimiter.consume("user1");
			expect(rateLimiter.getWindowCount()).toBe(1);

			await rateLimiter.consume("user2");
			expect(rateLimiter.getWindowCount()).toBe(2);
		});
	});
});
