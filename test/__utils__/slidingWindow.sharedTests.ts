import { describe, expect, it, vi } from "vitest";
import type { SlidingWindowRateLimiter } from "../../src/algorithms/slidingWindow";

export function runSlidingWindowRateLimiterTests(
	getRateLimiter: () => SlidingWindowRateLimiter,
) {
	describe("consume()", () => {
		it("should allow requests that are under the limit", async () => {
			const rateLimiter = getRateLimiter();
			const result = await rateLimiter.consume("sw-key-1");
			expect(result.success).toBe(true);
			expect(result.remaining).toBe(9);
		});

		it("should deny requests over the limit", async () => {
			const rateLimiter = getRateLimiter();
			for (let i = 0; i < 10; i++) {
				await rateLimiter.consume("sw-key-2");
			}
			const result = await rateLimiter.consume("sw-key-2");
			expect(result.success).toBe(false);
			expect(result.remaining).toBe(0);
		});

		it("should handle bursts at the window edge correctly", async () => {
			const rateLimiter = getRateLimiter();
			vi.useFakeTimers();
			const now = new Date("2023-01-01T00:00:00.000Z").getTime();
			vi.setSystemTime(now);

			// Consume 5 requests at the end of the first window
			vi.setSystemTime(now + 50 * 1000);
			for (let i = 0; i < 5; i++) {
				await rateLimiter.consume("burst-key");
			}

			// Move to 20 seconds into the next window
			vi.setSystemTime(now + 80 * 1000);
			const result = await rateLimiter.getRemaining("burst-key");

			// Weight of previous window is (60-20)/60 = 0.666
			// Previous count is 5. Weighted count = 5 * 0.666 = 3.33
			// Remaining should be 10 - 3 = 7
			expect(result).toBe(7);

			// Should be able to make 7 more requests
			for (let i = 0; i < 7; i++) {
				const consumeResult = await rateLimiter.consume("burst-key");
				expect(consumeResult.success).toBe(true);
			}

			// Next one should fail
			const finalResult = await rateLimiter.consume("burst-key");
			expect(finalResult.success).toBe(false);
		});
	});
}
