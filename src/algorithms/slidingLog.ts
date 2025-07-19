export interface SlidingLogResult {
	/** Indicates whether the request was successful. */
	success: boolean;
	/** The number of requests remaining in the current window. */
	remaining: number;
}

/**
 * Interface for a sliding log rate limiter.
 *
 * ## Algorithm Overview
 *
 * This algorithm keeps a log of timestamps for each request in a sorted set.
 * It's more accurate than the fixed window approach because it doesn't suffer
 * from bursty traffic at the window edges.
 *
 * ## How It Works
 *
 * 1. **Log Timestamps**: Each incoming request's timestamp is added to a sorted
 *    set for the corresponding user key.
 * 2. **Remove Old Entries**: Before adding a new request, all timestamps older
 *    than the defined interval are removed from the set.
 * 3. **Check Limit**: The size of the set (the number of requests in the current
 *    sliding window) is checked against the limit.
 * 4. **Atomicity**: All operations (cleanup, check, add) are performed in a
 *    single atomic operation to prevent race conditions.
 *
 * ## Key Benefits
 *
 * - **High Accuracy**: Provides precise rate limiting without edge-case burst issues.
 * - **Fairness**: Ensures that the rate is maintained smoothly over time.
 */
export interface SlidingLogRateLimiter {
	/**
	 * Attempts to consume a token for a given key.
	 * @param key A unique identifier for the client.
	 * @param uniqueRequestId An optional unique ID for the request.
	 * @returns A promise resolving to the result of the operation.
	 */
	consume(key: string, uniqueRequestId?: string): Promise<SlidingLogResult>;

	/**
	 * Retrieves the number of remaining requests for a given key.
	 * @param key A unique identifier for the client.
	 * @returns A promise resolving to the number of remaining requests.
	 */
	getRemaining(key: string): Promise<number>;

	/**
	 * Returns the maximum number of requests allowed in a window.
	 */
	getLimit(): number;

	/**
	 * Returns the duration of the window in seconds.
	 */
	getInterval(): number;
}
