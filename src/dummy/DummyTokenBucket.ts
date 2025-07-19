import type {
	ConsumeResult,
	TokenBucketRateLimiter,
	TokenCountResult,
} from "../algorithms/tokenBucket";

/**
 * A dummy token bucket rate limiter that always returns -1 for all operations.
 * This is useful for testing purposes, or when you want to disable rate limiting.
 */
export class DummyTokenBucket implements TokenBucketRateLimiter {
	async consume(_key: string, _tokens: number = 1): Promise<ConsumeResult> {
		return {
			success: true,
			remainingTokens: -1,
			nextRefillAt: -1,
		};
	}

	async getRemainingTokens(_key: string): Promise<TokenCountResult> {
		return {
			remainingTokens: -1,
			nextRefillAt: 1,
		};
	}

	async addTokens(_key: string, _amount: number): Promise<void> {
		return;
	}

	async removeTokens(_key: string, _amount: number): Promise<void> {
		return;
	}

	getCapacity(): number {
		return -1;
	}

	getRefillAmount(): number {
		return -1;
	}

	getRefillInterval(): number {
		return -1;
	}
}
