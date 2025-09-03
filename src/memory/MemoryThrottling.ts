import type { Duration } from "pv-duration";
import type {
	ThrottlingRateLimiter,
	ThrottlingResult,
} from "../algorithms/throttling";

/**
 * In-memory implementation of a throttling rate limiter.
 *
 * This implementation enforces a minimum delay between requests by tracking
 * the last request timestamp for each key. It prevents burst traffic and
 * provides smooth, controlled access patterns.
 *
 * ## How It Works
 *
 * 1. **Timestamp Tracking**: Each key maintains a timestamp of the last allowed request
 * 2. **Delay Calculation**: When a new request arrives, the time since the last
 *    request is calculated
 * 3. **Throttling Decision**: If enough time has passed since the last request
 *    (based on the minimum interval), the request is allowed immediately.
 *    Otherwise, the request is throttled and must wait
 * 4. **Atomic Updates**: The last request timestamp is updated atomically to
 *    prevent race conditions
 */
export class MemoryThrottling implements ThrottlingRateLimiter {
	private readonly lastRequestTimes = new Map<string, number>();
	/**
	 * In milliseconds
	 */
	private readonly minInterval: number;

	/**
	 * Creates a new memory-based throttling rate limiter.
	 * @param minIntervalMs The minimum delay between requests in milliseconds.
	 */
	constructor(minInterval: Duration) {
		if (minInterval.milliseconds <= 0) {
			throw new Error("Minimum interval must be greater than 0");
		}
		this.minInterval = minInterval.milliseconds;
	}

	/**
	 * Attempts to process a request, enforcing the minimum delay between requests.
	 * @param key A unique identifier for the client (e.g., user ID, IP address).
	 * @returns A promise that resolves to an object indicating whether the request
	 *          can proceed immediately and how long to wait if throttled.
	 */
	async throttle(key: string): Promise<ThrottlingResult> {
		const now = Date.now();
		const lastRequestTime = this.lastRequestTimes.get(key) || 0;
		const timeSinceLastRequest = now - lastRequestTime;
		const waitTime = Math.max(0, this.minInterval - timeSinceLastRequest);

		if (waitTime === 0) {
			// Request can proceed immediately
			this.lastRequestTimes.set(key, now);
			return {
				success: true,
				waitTime: 0,
				nextAllowedAt: now,
			};
		} else {
			// Request is throttled
			const nextAllowedAt = lastRequestTime + this.minInterval;
			return {
				success: false,
				waitTime,
				nextAllowedAt,
			};
		}
	}

	/**
	 * Gets the current throttling status for a key without updating the timestamp.
	 * @param key A unique identifier for the client.
	 * @returns A promise that resolves to the throttling result for the current state.
	 */
	async getStatus(key: string): Promise<ThrottlingResult> {
		const now = Date.now();
		const lastRequestTime = this.lastRequestTimes.get(key) || 0;
		const timeSinceLastRequest = now - lastRequestTime;
		const waitTime = Math.max(0, this.minInterval - timeSinceLastRequest);

		if (waitTime === 0) {
			return {
				success: true,
				waitTime: 0,
				nextAllowedAt: now,
			};
		} else {
			const nextAllowedAt = lastRequestTime + this.minInterval;
			return {
				success: false,
				waitTime,
				nextAllowedAt,
			};
		}
	}

	/**
	 * Returns the minimum delay between requests in milliseconds.
	 */
	getMinInterval(): number {
		return this.minInterval;
	}

	/**
	 * Returns the minimum delay between requests in seconds.
	 */
	getMinIntervalSeconds(): number {
		return this.minInterval / 1000;
	}

	/**
	 * Clears the throttling state for a specific key.
	 * @param key A unique identifier for the client.
	 */
	clear(key: string): void {
		this.lastRequestTimes.delete(key);
	}

	/**
	 * Clears all throttling states.
	 */
	clearAll(): void {
		this.lastRequestTimes.clear();
	}

	/**
	 * Gets the number of active keys being tracked.
	 */
	getActiveKeyCount(): number {
		return this.lastRequestTimes.size;
	}

	/**
	 * Gets the last request time for a specific key.
	 * @param key A unique identifier for the client.
	 * @returns The timestamp of the last request, or undefined if no request has been made.
	 */
	getLastRequestTime(key: string): number | undefined {
		return this.lastRequestTimes.get(key);
	}
}
