import Redis from "ioredis";
import { Duration } from "pv-duration";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IORedisSlidingLogRateLimiter } from "../../src/ioredis/IORedisSlidingLog";
import { useRedisContainer } from "../__utils__/containers";
import { runSlidingLogRateLimiterTests } from "../__utils__/slidingLog.sharedTests";

describe("SlidingLogRateLimiter", () => {
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
			const limiter = new IORedisSlidingLogRateLimiter(
				redisClient,
				"test-sl",
				10,
				Duration.ofSeconds(60),
			);
			expect(limiter.getLimit()).toBe(10);
			expect(limiter.getInterval()).toBe(60);
		});

		it("should throw error for zero limit", () => {
			expect(() => {
				new IORedisSlidingLogRateLimiter(
					redisClient,
					"test-sl",
					0,
					Duration.ofSeconds(60),
				);
			}).toThrow("Limit and interval must be positive values.");
		});
	});

	runSlidingLogRateLimiterTests(
		() =>
			new IORedisSlidingLogRateLimiter(
				redisClient,
				"test-sl",
				5,
				Duration.ofSeconds(10),
			),
	);
});
