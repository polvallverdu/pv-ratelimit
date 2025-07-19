// Export interfaces

export type { FixedWindowRateLimiter } from "./algorithms/fixedWindow";
export type { LeakyBucketRateLimiter } from "./algorithms/leakyBucket";
export type { SlidingLogRateLimiter } from "./algorithms/slidingLog";
export type { SlidingWindowRateLimiter } from "./algorithms/slidingWindow";
export type { TokenBucketRateLimiter } from "./algorithms/tokenBucket";
// Export dummy implementations
export {
	DummyFixedWindow,
	DummyLeakyBucket,
	DummySlidingLog,
	DummySlidingWindow,
	DummyTokenBucket,
} from "./dummy";
// Export Redis implementations
export {
	IORedisFixedWindowRateLimiter,
	IORedisLeakyBucketRateLimiter,
	IORedisSlidingLogRateLimiter,
	IORedisSlidingWindowRateLimiter,
	IORedisTokenBucketRateLimiter,
} from "./ioredis";
