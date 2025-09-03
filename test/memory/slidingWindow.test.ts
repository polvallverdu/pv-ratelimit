import { Duration } from "pv-duration";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemorySlidingWindow } from "../../src/memory/MemorySlidingWindow";
import { runSlidingWindowRateLimiterTests } from "../__utils__/slidingWindow.sharedTests";

describe("MemorySlidingWindow", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("Constructor", () => {
		it("should create a rate limiter with valid parameters", () => {
			const limiter = new MemorySlidingWindow(10, Duration.ofSeconds(60));
			expect(limiter.getLimit()).toBe(10);
			expect(limiter.getInterval()).toBe(60);
		});

		it("should throw error for zero limit", () => {
			expect(() => {
				new MemorySlidingWindow(0, Duration.ofSeconds(60));
			}).toThrow("Limit must be greater than 0");
		});

		it("should throw error for zero interval", () => {
			expect(() => {
				new MemorySlidingWindow(10, Duration.ofSeconds(0));
			}).toThrow("Interval must be greater than 0");
		});

		it("should throw error for negative limit", () => {
			expect(() => {
				new MemorySlidingWindow(-1, Duration.ofSeconds(60));
			}).toThrow("Limit must be greater than 0");
		});

		it("should throw error for negative interval", () => {
			expect(() => {
				new MemorySlidingWindow(10, Duration.ofSeconds(-1));
			}).toThrow("Interval must be greater than 0");
		});
	});

	runSlidingWindowRateLimiterTests(
		() => new MemorySlidingWindow(10, Duration.ofSeconds(60)),
	);
});
