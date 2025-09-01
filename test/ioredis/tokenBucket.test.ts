import Redis from "ioredis";
import { Duration } from "pv-duration";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IORedisTokenBucketRateLimiter } from "../../src/ioredis/IORedisTokenBucket";
import { useRedisContainer } from "../__utils__/containers";
import { runTokenBucketRateLimiterTests } from "../__utils__/tokenBucket.sharedTests";

describe("TokenBucketRateLimiter", () => {
	const getRedisContainer = useRedisContainer();

	let redisClient: Redis;

	beforeEach(() => {
		const container = getRedisContainer();
		redisClient = new Redis(container?.getConnectionUrl() ?? "");
		vi.stubEnv("RATE_LIMIT_ENABLED", "true");
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	describe("Constructor", () => {
		it("should create a rate limiter with valid parameters", () => {
			const limiter = new IORedisTokenBucketRateLimiter(
				redisClient,
				"test-tb",
				10,
				5,
				Duration.ofSeconds(60),
			);
			expect(limiter.getCapacity()).toBe(10);
		});

		it("should throw error for zero capacity", () => {
			expect(() => {
				new IORedisTokenBucketRateLimiter(
					redisClient,
					"test-tb",
					0,
					5,
					Duration.ofSeconds(60),
				);
			}).toThrow(
				"Capacity, refill amount, and interval must be positive values.",
			);
		});

		it("should throw error for negative capacity", () => {
			expect(() => {
				new IORedisTokenBucketRateLimiter(
					redisClient,
					"test-tb",
					-1,
					5,
					Duration.ofSeconds(60),
				);
			}).toThrow(
				"Capacity, refill amount, and interval must be positive values.",
			);
		});

		it("should throw error for zero refill amount", () => {
			expect(() => {
				new IORedisTokenBucketRateLimiter(
					redisClient,
					"test-tb",
					10,
					0,
					Duration.ofSeconds(60),
				);
			}).toThrow(
				"Capacity, refill amount, and interval must be positive values.",
			);
		});

		it("should throw error for negative refill amount", () => {
			expect(() => {
				new IORedisTokenBucketRateLimiter(
					redisClient,
					"test-tb",
					10,
					-1,
					Duration.ofSeconds(60),
				);
			}).toThrow(
				"Capacity, refill amount, and interval must be positive values.",
			);
		});

		it("should throw error for zero refill interval", () => {
			expect(() => {
				new IORedisTokenBucketRateLimiter(
					redisClient,
					"test-tb",
					10,
					5,
					Duration.ofSeconds(0),
				);
			}).toThrow(
				"Capacity, refill amount, and interval must be positive values.",
			);
		});

		it("should throw error for negative refill interval", () => {
			expect(() => {
				new IORedisTokenBucketRateLimiter(
					redisClient,
					"test-tb",
					10,
					5,
					Duration.ofSeconds(-1),
				);
			}).toThrow(
				"Capacity, refill amount, and interval must be positive values.",
			);
		});
	});

	runTokenBucketRateLimiterTests(
		() =>
			new IORedisTokenBucketRateLimiter(
				redisClient,
				"test-tb",
				10,
				5,
				Duration.ofSeconds(60),
			),
	);
});
