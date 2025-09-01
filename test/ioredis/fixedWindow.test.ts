import Redis from "ioredis";
import { Duration } from "pv-duration";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IORedisFixedWindowRateLimiter } from "../../src/ioredis/IORedisFixedWindow";
import { useRedisContainer } from "../__utils__/containers";
import { runFixedWindowRateLimiterTests } from "../__utils__/fixedWindow.sharedTests";

describe("FixedWindowRateLimiter", () => {
	const getRedisContainer = useRedisContainer();

	let redisClient: Redis;

	beforeEach(() => {
		const container = getRedisContainer();
		redisClient = new Redis(container?.getConnectionUrl() ?? "");
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("Constructor", () => {
		it("should create a rate limiter with valid parameters", () => {
			const limiter = new IORedisFixedWindowRateLimiter(
				redisClient,
				"test-fw",
				10,
				Duration.ofSeconds(60),
			);
			expect(limiter.getLimit()).toBe(10);
			expect(limiter.getInterval()).toBe(60);
		});

		it("should throw error for zero limit", () => {
			expect(() => {
				new IORedisFixedWindowRateLimiter(
					redisClient,
					"test-fw",
					0,
					Duration.ofSeconds(60),
				);
			}).toThrow("Limit and interval must be positive values.");
		});

		it("should throw error for zero interval", () => {
			expect(() => {
				new IORedisFixedWindowRateLimiter(
					redisClient,
					"test-fw",
					10,
					Duration.ofSeconds(0),
				);
			}).toThrow("Limit and interval must be positive values.");
		});
	});

	runFixedWindowRateLimiterTests(
		() =>
			new IORedisFixedWindowRateLimiter(
				redisClient,
				"test-fw",
				10,
				Duration.ofSeconds(60),
			),
	);
});
