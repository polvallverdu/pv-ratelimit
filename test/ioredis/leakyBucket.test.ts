import Redis from "ioredis";
import { Duration } from "pv-duration";
import { beforeEach, describe, expect, it } from "vitest";
import type { LeakyBucketRateLimiter } from "../../src/algorithms/leakyBucket";
import { IORedisLeakyBucketRateLimiter } from "../../src/ioredis/IORedisLeakyBucket";
import { useRedisContainer } from "../__utils__/containers";

describe("LeakyBucketRateLimiter", () => {
	const getRedisContainer = useRedisContainer();

	let rateLimiter: LeakyBucketRateLimiter;
	let redisClient: Redis;

	beforeEach(() => {
		const container = getRedisContainer();
		redisClient = new Redis(container?.getConnectionUrl() ?? "");

		rateLimiter = new IORedisLeakyBucketRateLimiter(
			redisClient,
			"test-lb",
			5, // capacity
			Duration.ofSeconds(60), // interval for TTL
		);
	});

	describe("Constructor", () => {
		it("should create a rate limiter with valid parameters", () => {
			const limiter = new IORedisLeakyBucketRateLimiter(
				redisClient,
				"test-lb",
				10,
				Duration.ofSeconds(60),
			);
			expect(limiter.getCapacity()).toBe(10);
		});

		it("should throw for invalid capacity", () => {
			expect(
				() =>
					new IORedisLeakyBucketRateLimiter(
						redisClient,
						"test-lb",
						0,
						Duration.ofSeconds(60),
					),
			).toThrow();
		});
	});

	describe("consume()", () => {
		it("should allow requests when bucket is not full", async () => {
			for (let i = 0; i < 5; i++) {
				const result = await rateLimiter.consume("q-key-1");
				expect(result.success).toBe(true);
				expect(result.remaining).toBe(5 - (i + 1));
			}
		});

		it("should reject requests when bucket is full", async () => {
			for (let i = 0; i < 5; i++) {
				await rateLimiter.consume("q-key-2");
			}
			const result = await rateLimiter.consume("q-key-2");
			expect(result.success).toBe(false);
			expect(result.remaining).toBe(0);
		});
	});

	describe("getState()", () => {
		it("should return correct state for a new bucket", async () => {
			const state = await rateLimiter.getState("new-q");
			expect(state.size).toBe(0);
			expect(state.remaining).toBe(5);
		});

		it("should return correct state after requests", async () => {
			await rateLimiter.consume("state-q");
			await rateLimiter.consume("state-q");
			const state = await rateLimiter.getState("state-q");
			expect(state.size).toBe(2);
			expect(state.remaining).toBe(3);
		});
	});
});
