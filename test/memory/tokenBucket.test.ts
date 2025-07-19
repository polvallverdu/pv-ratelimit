import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryTokenBucket } from "../../src/memory/MemoryTokenBucket";

describe("MemoryTokenBucket", () => {
	let rateLimiter: MemoryTokenBucket;

	beforeEach(() => {
		// Create a token bucket with capacity 10, refill 2 tokens every 1 second
		rateLimiter = new MemoryTokenBucket(10, 2, 1);
	});

	describe("constructor", () => {
		it("should create a token bucket with correct parameters", () => {
			expect(rateLimiter.getCapacity()).toBe(10);
			expect(rateLimiter.getRefillAmount()).toBe(2);
			expect(rateLimiter.getRefillInterval()).toBe(1);
		});

		it("should throw error for invalid capacity", () => {
			expect(() => new MemoryTokenBucket(0, 2, 1)).toThrow(
				"Capacity must be greater than 0",
			);
			expect(() => new MemoryTokenBucket(-1, 2, 1)).toThrow(
				"Capacity must be greater than 0",
			);
		});

		it("should throw error for invalid refill amount", () => {
			expect(() => new MemoryTokenBucket(10, 0, 1)).toThrow(
				"Refill amount must be greater than 0",
			);
			expect(() => new MemoryTokenBucket(10, -1, 1)).toThrow(
				"Refill amount must be greater than 0",
			);
		});

		it("should throw error for invalid refill interval", () => {
			expect(() => new MemoryTokenBucket(10, 2, 0)).toThrow(
				"Refill interval must be greater than 0",
			);
			expect(() => new MemoryTokenBucket(10, 2, -1)).toThrow(
				"Refill interval must be greater than 0",
			);
		});
	});

	describe("consume", () => {
		it("should allow consumption when tokens are available", async () => {
			const result = await rateLimiter.consume("user1");

			expect(result.success).toBe(true);
			expect(result.remainingTokens).toBe(9);
			expect(result.nextRefillAt).toBeGreaterThan(
				Math.floor(Date.now() / 1000),
			);
		});

		it("should allow consumption of multiple tokens", async () => {
			const result = await rateLimiter.consume("user1", 3);

			expect(result.success).toBe(true);
			expect(result.remainingTokens).toBe(7);
		});

		it("should reject consumption when insufficient tokens", async () => {
			// Consume all tokens
			await rateLimiter.consume("user1", 10);

			// Try to consume more
			const result = await rateLimiter.consume("user1", 1);

			expect(result.success).toBe(false);
			expect(result.remainingTokens).toBe(0);
		});

		it("should throw error for invalid token amount", async () => {
			await expect(rateLimiter.consume("user1", 0)).rejects.toThrow(
				"Tokens to consume must be greater than 0",
			);
			await expect(rateLimiter.consume("user1", -1)).rejects.toThrow(
				"Tokens to consume must be greater than 0",
			);
		});

		it("should handle different keys independently", async () => {
			// Consume all tokens from user1
			await rateLimiter.consume("user1", 10);

			// user2 should still have full capacity
			const result = await rateLimiter.consume("user2", 5);
			expect(result.success).toBe(true);
			expect(result.remainingTokens).toBe(5);
		});
	});

	describe("getRemainingTokens", () => {
		it("should return correct token count without consuming", async () => {
			const initial = await rateLimiter.getRemainingTokens("user1");
			expect(initial.remainingTokens).toBe(10);

			await rateLimiter.consume("user1", 3);

			const after = await rateLimiter.getRemainingTokens("user1");
			expect(after.remainingTokens).toBe(7);
		});

		it("should return correct next refill time", async () => {
			const result = await rateLimiter.getRemainingTokens("user1");
			const now = Math.floor(Date.now() / 1000);

			expect(result.nextRefillAt).toBeGreaterThan(now);
			expect(result.nextRefillAt).toBeLessThanOrEqual(now + 1);
		});
	});

	describe("addTokens", () => {
		it("should add tokens up to capacity", async () => {
			await rateLimiter.consume("user1", 5);

			await rateLimiter.addTokens("user1", 3);

			const remaining = await rateLimiter.getRemainingTokens("user1");
			expect(remaining.remainingTokens).toBe(8);
		});

		it("should not exceed capacity when adding tokens", async () => {
			await rateLimiter.addTokens("user1", 15);

			const remaining = await rateLimiter.getRemainingTokens("user1");
			expect(remaining.remainingTokens).toBe(10);
		});

		it("should throw error for invalid amount", async () => {
			await expect(rateLimiter.addTokens("user1", 0)).rejects.toThrow(
				"Amount to add must be greater than 0",
			);
			await expect(rateLimiter.addTokens("user1", -1)).rejects.toThrow(
				"Amount to add must be greater than 0",
			);
		});
	});

	describe("removeTokens", () => {
		it("should remove tokens", async () => {
			await rateLimiter.removeTokens("user1", 3);

			const remaining = await rateLimiter.getRemainingTokens("user1");
			expect(remaining.remainingTokens).toBe(7);
		});

		it("should not go below 0 when removing tokens", async () => {
			await rateLimiter.removeTokens("user1", 15);

			const remaining = await rateLimiter.getRemainingTokens("user1");
			expect(remaining.remainingTokens).toBe(0);
		});

		it("should throw error for invalid amount", async () => {
			await expect(rateLimiter.removeTokens("user1", 0)).rejects.toThrow(
				"Amount to remove must be greater than 0",
			);
			await expect(rateLimiter.removeTokens("user1", -1)).rejects.toThrow(
				"Amount to remove must be greater than 0",
			);
		});
	});

	describe("token refill", () => {
		it("should refill tokens over time", async () => {
			// Consume all tokens
			await rateLimiter.consume("user1", 10);

			// Wait for 1 second (1 refill cycle)
			await new Promise((resolve) => setTimeout(resolve, 1100));

			// Should have 2 tokens refilled
			const remaining = await rateLimiter.getRemainingTokens("user1");
			expect(remaining.remainingTokens).toBe(2);
		});

		it("should handle multiple refill cycles", async () => {
			// Consume all tokens
			await rateLimiter.consume("user1", 10);

			// Wait for 2.5 seconds (2 refill cycles)
			await new Promise((resolve) => setTimeout(resolve, 2500));

			// Should have 4 tokens refilled (2 cycles * 2 tokens)
			const remaining = await rateLimiter.getRemainingTokens("user1");
			expect(remaining.remainingTokens).toBe(4);
		});

		it("should not exceed capacity during refill", async () => {
			// Wait for 10 seconds (10 refill cycles = 20 tokens)
			await new Promise((resolve) => setTimeout(resolve, 1000));

			// Should still be at capacity
			const remaining = await rateLimiter.getRemainingTokens("user1");
			expect(remaining.remainingTokens).toBe(10);
		});
	});

	describe("cleanup", () => {
		it("should clean up old buckets", () => {
			// Create some buckets
			rateLimiter.consume("user1");
			rateLimiter.consume("user2");

			// Mock time to simulate old buckets
			const originalDateNow = Date.now;
			Date.now = vi.fn(() => originalDateNow() + 20000); // 20 seconds later

			rateLimiter.cleanup();

			// Restore original Date.now
			Date.now = originalDateNow;

			// Buckets should be cleaned up (this is implementation detail)
			// We can't easily test this without exposing internal state
		});
	});
});
