import type { Duration } from "pv-duration";
import type {
	TokenBucketRateLimiter,
	TokenConsumeResult,
	TokenCountResult,
} from "../algorithms/tokenBucket";

interface BucketState {
	/** Current number of tokens in the bucket */
	tokens: number;
	/** Timestamp of the last refill (in seconds) */
	lastRefill: number;
}

/**
 * In-memory implementation of the token bucket rate limiter.
 *
 * This implementation stores bucket state in memory using a Map, making it
 * suitable for single-instance applications or testing purposes.
 *
 * ## Features
 * - Continuous token refill at a fixed rate
 * - Burst handling up to bucket capacity
 * - Atomic token consumption operations
 * - Automatic cleanup of expired buckets
 */
export class MemoryTokenBucket implements TokenBucketRateLimiter {
	private buckets = new Map<string, BucketState>();
	private readonly capacity: number;
	private readonly refillAmount: number;
	/**
	 * In seconds
	 */
	private readonly refillInterval: number;

	/**
	 * Creates a new memory-based token bucket rate limiter.
	 * @param capacity Maximum number of tokens the bucket can hold
	 * @param refillAmount Number of tokens added per refill interval
	 * @param refillInterval Refill interval
	 */
	constructor(
		capacity: number,
		refillAmount: number,
		refillInterval: Duration,
	) {
		if (capacity <= 0) {
			throw new Error("Capacity must be greater than 0");
		}
		if (refillAmount <= 0) {
			throw new Error("Refill amount must be greater than 0");
		}
		if (refillInterval.seconds <= 0) {
			throw new Error("Refill interval must be greater than 0");
		}

		this.capacity = capacity;
		this.refillAmount = refillAmount;
		this.refillInterval = refillInterval.seconds;
	}

	/**
	 * Attempts to consume tokens from the bucket.
	 * @param key Unique identifier for the bucket
	 * @param tokens Number of tokens to consume (defaults to 1)
	 * @returns Promise resolving to the result of the operation
	 */
	async consume(key: string, tokens: number = 1): Promise<TokenConsumeResult> {
		if (tokens < 0) {
			throw new Error("Tokens to consume must be greater than or equal to 0");
		}

		const now = Math.floor(Date.now() / 1000);
		const bucket = this.getOrCreateBucket(key, now);

		// Refill tokens based on elapsed time
		this.refillBucket(bucket, now);

		// Check if enough tokens are available
		if (bucket.tokens < tokens) {
			return {
				success: false,
				remainingTokens: bucket.tokens,
				nextRefillAt: bucket.lastRefill + this.refillInterval,
			};
		}

		// Consume tokens
		bucket.tokens -= tokens;
		bucket.lastRefill = now;

		return {
			success: true,
			remainingTokens: bucket.tokens,
			nextRefillAt: bucket.lastRefill + this.refillInterval,
		};
	}

	/**
	 * Gets the current number of tokens in the bucket without consuming any.
	 * @param key Unique identifier for the bucket
	 * @returns Promise resolving to the current token count and next refill time
	 */
	async getRemainingTokens(key: string): Promise<TokenCountResult> {
		const now = Math.floor(Date.now() / 1000);
		const bucket = this.getOrCreateBucket(key, now);

		// Refill tokens based on elapsed time
		this.refillBucket(bucket, now);

		return {
			remainingTokens: bucket.tokens,
			nextRefillAt: bucket.lastRefill + this.refillInterval,
		};
	}

	/**
	 * Manually adds tokens to the bucket.
	 * @param key Unique identifier for the bucket
	 * @param amount Number of tokens to add
	 */
	async addTokens(key: string, amount: number): Promise<void> {
		if (amount <= 0) {
			throw new Error("Amount to add must be greater than 0");
		}

		const now = Math.floor(Date.now() / 1000);
		const bucket = this.getOrCreateBucket(key, now);

		// Refill tokens based on elapsed time
		this.refillBucket(bucket, now);

		// Add tokens up to capacity
		bucket.tokens = Math.min(this.capacity, bucket.tokens + amount);
	}

	/**
	 * Manually removes tokens from the bucket.
	 * @param key Unique identifier for the bucket
	 * @param amount Number of tokens to remove
	 */
	async removeTokens(key: string, amount: number): Promise<void> {
		if (amount <= 0) {
			throw new Error("Amount to remove must be greater than 0");
		}

		const now = Math.floor(Date.now() / 1000);
		const bucket = this.getOrCreateBucket(key, now);

		// Refill tokens based on elapsed time
		this.refillBucket(bucket, now);

		// Remove tokens (cannot go below 0)
		bucket.tokens = Math.max(0, bucket.tokens - amount);
	}

	/**
	 * Returns the maximum capacity of the bucket.
	 */
	getCapacity(): number {
		return this.capacity;
	}

	/**
	 * Returns the number of tokens added per refill interval.
	 */
	getRefillAmount(): number {
		return this.refillAmount;
	}

	/**
	 * Returns the refill interval in seconds.
	 */
	getRefillInterval(): number {
		return this.refillInterval;
	}

	/**
	 * Gets or creates a bucket for the given key.
	 * @param key Unique identifier for the bucket
	 * @param now Current timestamp in seconds
	 * @returns Bucket state
	 */
	private getOrCreateBucket(key: string, now: number): BucketState {
		let bucket = this.buckets.get(key);
		if (!bucket) {
			bucket = {
				tokens: this.capacity, // Start with full capacity
				lastRefill: now,
			};
			this.buckets.set(key, bucket);
		}
		return bucket;
	}

	/**
	 * Refills the bucket based on elapsed time since last refill.
	 * @param bucket Bucket state to refill
	 * @param now Current timestamp in seconds
	 */
	private refillBucket(bucket: BucketState, now: number): void {
		const timeElapsed = now - bucket.lastRefill;
		const refillCycles = Math.floor(timeElapsed / this.refillInterval);

		if (refillCycles > 0) {
			const tokensToAdd = refillCycles * this.refillAmount;
			bucket.tokens = Math.min(this.capacity, bucket.tokens + tokensToAdd);
			bucket.lastRefill = now;
		}
	}

	/**
	 * Cleans up expired buckets (optional utility method).
	 * This can be called periodically to free memory.
	 */
	cleanup(): void {
		const now = Math.floor(Date.now() / 1000);
		const maxAge = this.refillInterval * 10; // Keep buckets for 10 refill cycles

		for (const [key, bucket] of this.buckets.entries()) {
			if (now - bucket.lastRefill > maxAge) {
				this.buckets.delete(key);
			}
		}
	}
}
