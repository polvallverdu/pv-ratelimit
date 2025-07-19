import type {
	FixedWindowRateLimiter,
	FixedWindowResult,
} from "../algorithms/fixedWindow";

/**
 * A dummy fixed window rate limiter that always returns success with -1 remaining tokens.
 * This is useful for testing purposes, or when you want to disable rate limiting.
 */
export class DummyFixedWindow implements FixedWindowRateLimiter {
	async consume(_key: string): Promise<FixedWindowResult> {
		return {
			success: true,
			remaining: -1,
		};
	}

	async getRemaining(_key: string): Promise<number> {
		return -1;
	}

	getLimit(): number {
		return -1;
	}

	getInterval(): number {
		return -1;
	}
}
