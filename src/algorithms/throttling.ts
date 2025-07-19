export interface ThrottlingResult {
	/** Indicates whether the request was allowed to proceed immediately. */
	success: boolean;
	/** The number of milliseconds to wait before the next request is allowed. */
	waitTime: number;
	/** The timestamp when the next request will be allowed. */
	nextAllowedAt: number;
}

/**
 * Interface for a throttling rate limiter.
 *
 * ## Algorithm Overview
 *
 * This algorithm enforces a minimum delay between requests by tracking the last
 * request timestamp for each key. Unlike counting-based rate limiters, throttling
 * ensures that requests are spaced out evenly over time, preventing burst traffic
 * and providing smooth, controlled access patterns.
 *
 * ## How It Works
 *
 * 1. **Timestamp Tracking**: Each key maintains a timestamp of the last allowed request.
 * 2. **Delay Calculation**: When a new request arrives, the time since the last
 *    request is calculated.
 * 3. **Throttling Decision**: If enough time has passed since the last request
 *    (based on the minimum interval), the request is allowed immediately.
 *    Otherwise, the request is throttled and must wait.
 * 4. **Atomic Updates**: The last request timestamp is updated atomically to
 *    prevent race conditions in distributed environments.
 *
 * ## Key Benefits
 *
 * - **Smooth Traffic**: Prevents burst traffic by enforcing consistent delays.
 * - **Predictable Behavior**: Each request is guaranteed to have a minimum
 *   interval from the previous one.
 * - **Fair Distribution**: Ensures requests are evenly distributed over time.
 * - **Simple Implementation**: Easy to understand and implement.
 *
 * ## Use Cases
 *
 * - API rate limiting where you want to prevent bursts
 * - Database query throttling to prevent overwhelming the system
 * - External service integration with strict rate requirements
 * - User interface throttling to prevent rapid-fire actions
 */
export interface ThrottlingRateLimiter {
	/**
	 * Attempts to process a request, enforcing the minimum delay between requests.
	 * @param key A unique identifier for the client (e.g., user ID, IP address).
	 * @returns A promise that resolves to an object indicating whether the request
	 *          can proceed immediately and how long to wait if throttled.
	 */
	throttle(key: string): Promise<ThrottlingResult>;

	/**
	 * Gets the current throttling status for a key without updating the timestamp.
	 * @param key A unique identifier for the client.
	 * @returns A promise that resolves to the throttling result for the current state.
	 */
	getStatus(key: string): Promise<ThrottlingResult>;

	/**
	 * Returns the minimum delay between requests in milliseconds.
	 */
	getMinInterval(): number;

	/**
	 * Returns the minimum delay between requests in seconds.
	 */
	getMinIntervalSeconds(): number;
}
