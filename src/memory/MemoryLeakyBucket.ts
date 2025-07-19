import type {
	LeakyBucketRateLimiter,
	LeakyBucketResult,
	LeakyBucketState,
} from "../algorithms/leakyBucket";

interface BucketData {
	/** Array of request IDs in the queue */
	requests: string[];
	/** Timestamp when the bucket was last accessed */
	lastAccessed: number;
}

/**
 * In-memory implementation of the Leaky Bucket Rate Limiter.
 *
 * This implementation uses a Map to store bucket data for each key.
 * Each bucket maintains a queue of request IDs up to the specified capacity.
 * When the queue is full, new requests are rejected.
 *
 * ## Memory Management
 * - Buckets are automatically cleaned up when they haven't been accessed for a long time
 * - The Map grows with the number of unique keys
 * - Each key stores only the current queue of requests
 * - No automatic "leak" mechanism - this is a simple overflow protection
 */
export class MemoryLeakyBucket implements LeakyBucketRateLimiter {
	private readonly storage = new Map<string, BucketData>();
	private readonly capacity: number;
	private readonly cleanupInterval: number;

	/**
	 * Creates a new Memory Leaky Bucket Rate Limiter.
	 * @param capacity Maximum number of requests that can be queued
	 * @param cleanupIntervalMs Optional interval in milliseconds for automatic cleanup (default: 1 hour)
	 */
	constructor(capacity: number, cleanupIntervalMs: number = 60 * 60 * 1000) {
		if (capacity <= 0) {
			throw new Error("Capacity must be greater than 0");
		}
		if (cleanupIntervalMs <= 0) {
			throw new Error("Cleanup interval must be greater than 0");
		}

		this.capacity = capacity;
		this.cleanupInterval = cleanupIntervalMs;

		// Set up periodic cleanup
		this.startPeriodicCleanup();
	}

	/**
	 * Attempts to add a request to the bucket's queue.
	 * @param key A unique identifier for the client.
	 * @param uniqueRequestId An optional unique ID for the request.
	 * @returns A promise resolving to the result of the operation.
	 */
	async consume(
		key: string,
		uniqueRequestId?: string,
	): Promise<LeakyBucketResult> {
		const now = Date.now();
		const requestId = uniqueRequestId || this.generateRequestId();

		// Get or create bucket data for this key
		let bucketData = this.storage.get(key);

		// If no data exists, create fresh bucket
		if (!bucketData) {
			bucketData = {
				requests: [],
				lastAccessed: now,
			};
		} else {
			// Update last accessed time
			bucketData.lastAccessed = now;
		}

		// Check if we can add a request to the queue
		if (bucketData.requests.length >= this.capacity) {
			// Update storage even if we don't add the request (to update lastAccessed)
			this.storage.set(key, bucketData);
			return {
				success: false,
				remaining: 0,
			};
		}

		// Add the request to the queue
		bucketData.requests.push(requestId);
		this.storage.set(key, bucketData);

		return {
			success: true,
			remaining: this.capacity - bucketData.requests.length,
		};
	}

	/**
	 * Retrieves the current state of the bucket (queue size and remaining capacity).
	 * @param key A unique identifier for the client.
	 * @returns A promise resolving to the bucket's state.
	 */
	async getState(key: string): Promise<LeakyBucketState> {
		const bucketData = this.storage.get(key);

		if (!bucketData) {
			return {
				size: 0,
				remaining: this.capacity,
			};
		}

		return {
			size: bucketData.requests.length,
			remaining: this.capacity - bucketData.requests.length,
		};
	}

	/**
	 * Returns the capacity of the bucket.
	 */
	getCapacity(): number {
		return this.capacity;
	}

	/**
	 * Generates a unique request ID if none is provided.
	 * @returns A unique request ID
	 */
	private generateRequestId(): string {
		return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Starts periodic cleanup of expired buckets.
	 */
	private startPeriodicCleanup(): void {
		setInterval(() => {
			this.cleanupExpired();
		}, this.cleanupInterval);
	}

	/**
	 * Cleans up buckets that haven't been accessed for a long time.
	 * This helps prevent memory leaks by removing unused buckets.
	 */
	private cleanupExpired(): void {
		const now = Date.now();
		const cutoffTime = now - this.cleanupInterval;

		for (const [key, bucketData] of this.storage.entries()) {
			if (bucketData.lastAccessed < cutoffTime) {
				this.storage.delete(key);
			}
		}
	}

	/**
	 * Manually removes a specific request from the bucket.
	 * @param key The key to remove the request from
	 * @param requestId The request ID to remove
	 * @returns True if the request was found and removed, false otherwise
	 */
	removeRequest(key: string, requestId: string): boolean {
		const bucketData = this.storage.get(key);
		if (!bucketData) {
			return false;
		}

		const index = bucketData.requests.indexOf(requestId);
		if (index === -1) {
			return false;
		}

		bucketData.requests.splice(index, 1);
		bucketData.lastAccessed = Date.now();
		this.storage.set(key, bucketData);
		return true;
	}

	/**
	 * Gets the current number of active keys in storage.
	 * Useful for monitoring memory usage.
	 */
	getActiveKeyCount(): number {
		return this.storage.size;
	}

	/**
	 * Gets the total number of requests across all buckets.
	 * Useful for monitoring overall queue usage.
	 */
	getTotalRequestCount(): number {
		let total = 0;
		for (const bucketData of this.storage.values()) {
			total += bucketData.requests.length;
		}
		return total;
	}

	/**
	 * Clears all stored data.
	 * Useful for testing or resetting the rate limiter.
	 */
	clear(): void {
		this.storage.clear();
	}

	/**
	 * Gets all request IDs for a specific key.
	 * Useful for debugging or monitoring specific buckets.
	 * @param key The key to get requests for
	 * @returns Array of request IDs, or empty array if key doesn't exist
	 */
	getRequests(key: string): string[] {
		const bucketData = this.storage.get(key);
		return bucketData ? [...bucketData.requests] : [];
	}
}
