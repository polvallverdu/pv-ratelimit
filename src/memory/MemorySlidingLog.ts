import type {
	SlidingLogRateLimiter,
	SlidingLogResult,
} from "../algorithms/slidingLog";

/**
 * In-memory implementation of the Sliding Log Rate Limiter.
 *
 * This algorithm keeps a log of timestamps for each request in a sorted array.
 * It's more accurate than the fixed window approach because it doesn't suffer
 * from bursty traffic at the window edges.
 *
 * ## How It Works
 *
 * 1. **Log Timestamps**: Each incoming request's timestamp is added to a sorted
 *    array for the corresponding user key.
 * 2. **Remove Old Entries**: Before adding a new request, all timestamps older
 *    than the defined interval are removed from the array.
 * 3. **Check Limit**: The size of the array (the number of requests in the current
 *    sliding window) is checked against the limit.
 * 4. **Atomicity**: All operations (cleanup, check, add) are performed in a
 *    single operation to prevent race conditions.
 */
export class MemorySlidingLog implements SlidingLogRateLimiter {
	private readonly storage = new Map<string, number[]>();
	private readonly limit: number;
	private readonly interval: number;

	/**
	 * Creates a new MemorySlidingLog instance.
	 * @param limit The maximum number of requests allowed in the sliding window.
	 * @param interval The duration of the sliding window in seconds.
	 */
	constructor(limit: number, interval: number) {
		if (limit <= 0) {
			throw new Error("Limit must be greater than 0");
		}
		if (interval <= 0) {
			throw new Error("Interval must be greater than 0");
		}

		this.limit = limit;
		this.interval = interval;
	}

	/**
	 * Attempts to consume a token for a given key.
	 * @param key A unique identifier for the client.
	 * @param uniqueRequestId An optional unique ID for the request (not used in this implementation).
	 * @returns A promise resolving to the result of the operation.
	 */
	async consume(
		key: string,
		uniqueRequestId?: string,
	): Promise<SlidingLogResult> {
		const now = Math.floor(Date.now() / 1000);
		const cutoffTime = now - this.interval;

		// Get or create the timestamp array for this key
		let timestamps = this.storage.get(key);
		if (!timestamps) {
			timestamps = [];
			this.storage.set(key, timestamps);
		}

		// Remove expired timestamps (older than the interval)
		const validTimestamps = timestamps.filter(
			(timestamp) => timestamp > cutoffTime,
		);

		// Check if adding this request would exceed the limit
		if (validTimestamps.length >= this.limit) {
			// Update storage with cleaned timestamps
			this.storage.set(key, validTimestamps);
			return {
				success: false,
				remaining: 0,
			};
		}

		// Add the current timestamp and update storage
		validTimestamps.push(now);
		this.storage.set(key, validTimestamps);

		return {
			success: true,
			remaining: this.limit - validTimestamps.length,
		};
	}

	/**
	 * Retrieves the number of remaining requests for a given key.
	 * @param key A unique identifier for the client.
	 * @returns A promise resolving to the number of remaining requests.
	 */
	async getRemaining(key: string): Promise<number> {
		const now = Math.floor(Date.now() / 1000);
		const cutoffTime = now - this.interval;

		const timestamps = this.storage.get(key);
		if (!timestamps) {
			return this.limit;
		}

		// Count valid timestamps (within the sliding window)
		const validCount = timestamps.filter(
			(timestamp) => timestamp > cutoffTime,
		).length;
		return Math.max(0, this.limit - validCount);
	}

	/**
	 * Returns the maximum number of requests allowed in a window.
	 */
	getLimit(): number {
		return this.limit;
	}

	/**
	 * Returns the duration of the window in seconds.
	 */
	getInterval(): number {
		return this.interval;
	}

	/**
	 * Cleans up expired entries from the storage.
	 * This method can be called periodically to prevent memory leaks.
	 */
	cleanup(): void {
		const now = Math.floor(Date.now() / 1000);
		const cutoffTime = now - this.interval;

		for (const [key, timestamps] of this.storage.entries()) {
			const validTimestamps = timestamps.filter(
				(timestamp) => timestamp > cutoffTime,
			);
			if (validTimestamps.length === 0) {
				this.storage.delete(key);
			} else {
				this.storage.set(key, validTimestamps);
			}
		}
	}

	/**
	 * Gets the current number of active requests for a key.
	 * @param key A unique identifier for the client.
	 * @returns The number of active requests in the sliding window.
	 */
	getActiveRequests(key: string): number {
		const now = Math.floor(Date.now() / 1000);
		const cutoffTime = now - this.interval;

		const timestamps = this.storage.get(key);
		if (!timestamps) {
			return 0;
		}

		return timestamps.filter((timestamp) => timestamp > cutoffTime).length;
	}

	/**
	 * Clears all data for a specific key.
	 * @param key A unique identifier for the client.
	 */
	clear(key: string): void {
		this.storage.delete(key);
	}

	/**
	 * Clears all data from the storage.
	 */
	clearAll(): void {
		this.storage.clear();
	}

	/**
	 * Gets the total number of keys currently in storage.
	 */
	getKeyCount(): number {
		return this.storage.size;
	}
}
