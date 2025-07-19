import type {
	ThrottlingRateLimiter,
	ThrottlingResult,
} from "../algorithms/throttling";

/**
 * A dummy throttling rate limiter that always returns success with no wait time.
 * This is useful for testing purposes, or when you want to disable throttling.
 */
export class DummyThrottling implements ThrottlingRateLimiter {
	async throttle(_key: string): Promise<ThrottlingResult> {
		return {
			success: true,
			waitTime: 0,
			nextAllowedAt: Date.now(),
		};
	}

	async getStatus(_key: string): Promise<ThrottlingResult> {
		return {
			success: true,
			waitTime: 0,
			nextAllowedAt: Date.now(),
		};
	}

	getMinInterval(): number {
		return -1;
	}

	getMinIntervalSeconds(): number {
		return -1;
	}
}
