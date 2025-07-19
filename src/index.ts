// Export interfaces

export type {
	FixedWindowRateLimiter,
	FixedWindowResult,
} from "./algorithms/fixedWindow";
export type {
	LeakyBucketRateLimiter,
	LeakyBucketResult,
	LeakyBucketState,
} from "./algorithms/leakyBucket";
export type {
	SlidingLogRateLimiter,
	SlidingLogResult,
} from "./algorithms/slidingLog";
export type {
	SlidingWindowRateLimiter,
	SlidingWindowResult,
} from "./algorithms/slidingWindow";
export type {
	TokenBucketRateLimiter,
	TokenConsumeResult,
	TokenCountResult,
} from "./algorithms/tokenBucket";

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
