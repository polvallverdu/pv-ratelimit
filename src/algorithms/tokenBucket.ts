export interface ConsumeResult {
	/** Indicates whether the tokens were successfully consumed. */
	success: boolean;
	/** The number of tokens remaining in the bucket after this operation. */
	remainingTokens: number;
	/** A Unix timestamp (in seconds) indicating when the next refill will occur. */
	nextRefillAt: number;
}

export interface TokenCountResult {
	/** The number of tokens currently in the bucket. */
	remainingTokens: number;
	/** A Unix timestamp (in seconds) indicating when the next refill will occur. */
	nextRefillAt: number;
}

/**
 * Interface for a token bucket rate limiter implementation.
 *
 * ## Algorithm Overview
 *
 * The token bucket algorithm is a rate limiting technique that controls the rate at which
 * requests are processed. It works by maintaining a "bucket" that holds tokens, where:
 * - Tokens are added to the bucket at a fixed rate (refill rate)
 * - Each request consumes one or more tokens from the bucket
 * - If sufficient tokens are available, the request is allowed and tokens are consumed
 * - If insufficient tokens are available, the request is denied/rate limited
 *
 * ## How It Works
 *
 * 1. **Initialization**: The bucket starts with a specified capacity of tokens
 * 2. **Refilling**: Tokens are added to the bucket at regular intervals (refillInterval)
 *    - The bucket never exceeds its maximum capacity
 *    - Refills happen based on elapsed time since the last update
 * 3. **Consumption**: When a request arrives:
 *    - Calculate how many tokens should be added based on elapsed time
 *    - Check if enough tokens are available for the request
 *    - If yes: consume tokens and allow the request
 *    - If no: deny the request without consuming tokens
 *
 * ## Key Benefits
 *
 * - **Burst handling**: Allows short bursts of traffic up to the bucket capacity
 * - **Smooth rate limiting**: Provides consistent long-term rate limiting
 * - **Atomic operations**: Uses atomic operations for thread-safe behavior
 * - **Distributed**: Works across multiple application instances
 */
export interface TokenBucketRateLimiter {
	/**
	 * Attempts to consume a specified number of tokens from the bucket.
	 * @param key A unique identifier for the bucket (e.g., user ID, IP address).
	 * @param tokens The number of tokens to consume (defaults to 1).
	 * @returns A promise that resolves to true if tokens were consumed, false otherwise.
	 */
	consume(key: string, tokens?: number): Promise<ConsumeResult>;

	/**
	 * Gets the current number of tokens in the bucket without consuming any.
	 * @param key A unique identifier for the bucket (e.g., user ID, IP address).
	 * @returns A promise that resolves to the current token count and next refill time.
	 */
	getRemainingTokens(key: string): Promise<TokenCountResult>;

	/**
	 * Manually adds tokens to the bucket.
	 * @param key A unique identifier for the bucket.
	 * @param amount The number of tokens to add.
	 */
	addTokens(key: string, amount: number): Promise<void>;

	/**
	 * Manually removes tokens from the bucket.
	 * @param key A unique identifier for the bucket.
	 * @param amount The number of tokens to remove.
	 */
	removeTokens(key: string, amount: number): Promise<void>;

	/**
	 * Returns the maximum capacity of the bucket.
	 */
	getCapacity(): number;

	/**
	 * Returns the number of tokens added per refill interval.
	 */
	getRefillAmount(): number;

	/**
	 * Returns the refill interval in seconds.
	 */
	getRefillInterval(): number;
}
