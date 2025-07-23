import Redis from "ioredis";
import { Duration } from "pv-duration";
import { afterEach, beforeEach, describe, vi } from "vitest";
import { IORedisSlidingWindowRateLimiter } from "../../src/ioredis/IORedisSlidingWindow";
import { useRedisContainer } from "../__utils__/containers";
import { runSlidingWindowRateLimiterTests } from "../__utils__/slidingWindow.sharedTests";

describe("SlidingWindowRateLimiter", () => {
	const getRedisContainer = useRedisContainer();

	let redisClient: Redis;

	beforeEach(() => {
		const container = getRedisContainer();
		redisClient = new Redis(container?.getConnectionUrl() ?? "");
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	runSlidingWindowRateLimiterTests(
		() =>
			new IORedisSlidingWindowRateLimiter(
				redisClient,
				"test-sw",
				10,
				Duration.ofSeconds(60),
			),
	);
});
