import type { Duration } from "pv-duration";
import type {
	LeakyBucketRateLimiter,
	LeakyBucketResult,
	LeakyBucketState,
} from "../algorithms/leakyBucket";

interface QueueItem {
	/** Expiration timestamp in seconds */
	expiresAt: number;
}

interface QueueState {
	/** Items in the queue */
	items: QueueItem[];
}

/**
 * In-memory implementation of the leaky bucket rate limiter.
 *
 * This implementation models a simple queue with a fixed capacity. Requests are
 * added to the queue if there is space. If the queue is full, new requests are
 * rejected. This approach does not include a "leak" mechanism to process
 * requests at a steady rate but serves as a basic overflow protection.
 *
 * ## Features
 * - Thread-safe in-memory operations
 * - Automatic cleanup of expired requests
 * - Efficient queue management using arrays
 * - Memory cleanup utilities
 *
 * ## How It Works
 *
 * 1. **Queue Check**: On a new request, the current length of the queue
 *    is checked after cleaning expired items.
 * 2. **Enqueue or Reject**: If the queue size is less than its capacity, the new
 *    request is added. Otherwise, it is rejected.
 * 3. **Expiration**: Items are automatically expired based on the interval.
 *
 * @example
 * ```typescript
 * import { LeakyBucketRateLimiter } from './leakyBucket';
 *
 * // Create a bucket with a capacity of 20 requests
 * const rateLimiter = new MemoryLeakyBucket(20, { seconds: 300 });
 *
 * const userId = 'user-123';
 *
 * const result = await rateLimiter.consume(userId);
 *
 * if (result.success) {
 *   console.log(`Request accepted. Queue has ${20 - result.remaining} items.`);
 * } else {
 *   console.log('Request rejected. Bucket is full.');
 * }
 * ```
 */
export class MemoryLeakyBucket implements LeakyBucketRateLimiter {
	private readonly queues = new Map<string, QueueState>();
	private readonly capacity: number;
	/**
	 * In seconds
	 */
	private readonly interval: number;

	/**
	 * Creates a new memory-based leaky bucket rate limiter.
	 * @param capacity Maximum number of requests that can be queued
	 * @param interval Time after which requests expire
	 */
	constructor(capacity: number, interval: Duration) {
		if (capacity <= 0) {
			throw new Error("Capacity must be greater than 0");
		}
		if (interval.seconds <= 0) {
			throw new Error("Interval must be greater than 0");
		}

		this.capacity = capacity;
		this.interval = interval.seconds;
	}

	/**
	 * Attempts to add a request to the bucket's queue.
	 * @param key A unique identifier for the client.
	 * @returns A promise resolving to the result of the operation.
	 */
	async consume(key: string): Promise<LeakyBucketResult> {
		const now = Math.floor(Date.now() / 1000);
		const queue = this.getOrCreateQueue(key);

		// Clean expired items from the queue
		this.cleanupExpired(queue, now);

		// Check if queue has capacity
		if (queue.items.length >= this.capacity) {
			return {
				success: false,
				remaining: 0,
			};
		}

		// Add new request to queue
		const expiresAt = now + this.interval;
		queue.items.push({
			expiresAt,
		});

		return {
			success: true,
			remaining: this.capacity - queue.items.length,
		};
	}

	/**
	 * Retrieves the current state of the bucket (queue size and remaining capacity).
	 * @param key A unique identifier for the client.
	 * @returns A promise resolving to the bucket's state.
	 */
	async getState(key: string): Promise<LeakyBucketState> {
		const now = Math.floor(Date.now() / 1000);
		const queue = this.getOrCreateQueue(key);

		// Clean expired items from the queue
		this.cleanupExpired(queue, now);

		const size = queue.items.length;
		const remaining = Math.max(0, this.capacity - size);

		return { size, remaining };
	}

	/**
	 * Returns the capacity of the bucket.
	 */
	getCapacity(): number {
		return this.capacity;
	}

	/**
	 * Returns the interval in seconds after which requests expire.
	 */
	getInterval(): number {
		return this.interval;
	}

	/**
	 * Gets or creates a queue for the given key.
	 * @param key Unique identifier for the queue
	 * @returns Queue state
	 */
	private getOrCreateQueue(key: string): QueueState {
		let queue = this.queues.get(key);
		if (!queue) {
			queue = {
				items: [],
			};
			this.queues.set(key, queue);
		}
		return queue;
	}

	/**
	 * Removes expired items from the queue.
	 * @param queue Queue state to clean up
	 * @param now Current timestamp in seconds
	 */
	private cleanupExpired(queue: QueueState, now: number): void {
		// Filter out expired items
		queue.items = queue.items.filter((item) => item.expiresAt > now);
	}

	/**
	 * Cleans up expired items across all queues.
	 * This can be called periodically to free memory.
	 */
	cleanupAllExpired(): void {
		const now = Math.floor(Date.now() / 1000);

		for (const [key, queue] of this.queues.entries()) {
			this.cleanupExpired(queue, now);

			// Remove empty queues
			if (queue.items.length === 0) {
				this.queues.delete(key);
			}
		}
	}

	/**
	 * Gets the current number of active keys in storage.
	 * Useful for monitoring memory usage.
	 */
	getActiveKeyCount(): number {
		return this.queues.size;
	}

	/**
	 * Clears all stored data.
	 * Useful for testing or resetting the rate limiter.
	 */
	clear(): void {
		this.queues.clear();
	}
}
