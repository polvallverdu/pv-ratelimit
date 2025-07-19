export interface SlidingWindowResult {
	/** Indicates whether the request was successful. */
	success: boolean;
	/** The approximate number of requests remaining. */
	remaining: number;
}

/**
 * Interface for a sliding window counter rate limiter.
 *
 * ## Algorithm Overview
 *
 * This algorithm is a hybrid between the fixed window and sliding log approaches.
 * It provides a good balance of performance and accuracy by considering a weighted
 * value of the previous window's request count, effectively smoothing out bursts
 * that can occur at the boundaries of fixed windows.
 *
 * ## How It Works
 *
 * 1. **Two Windows**: It tracks counters for two consecutive windows: the current
 *    one and the previous one.
 * 2. **Weighted Calculation**: The current request rate is calculated by taking
 *    the full count of the current window and adding a weighted portion of the
 *    previous window's count. The weight is based on how much of the previous
 *    window still falls within the sliding interval.
 * 3. **Atomic Operations**: All steps are performed atomically: it fetches
 *    both counters, calculates the weighted rate, checks against the limit, and
 *    increments the current window's counter if the request is allowed.
 */
export interface SlidingWindowRateLimiter {
	/**
	 * Attempts to consume a token for a given key.
	 * @param key A unique identifier for the client.
	 * @returns A promise resolving to the result of the operation.
	 */
	consume(key: string): Promise<SlidingWindowResult>;

	/**
	 * Retrieves the approximate number of remaining requests for a given key.
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
