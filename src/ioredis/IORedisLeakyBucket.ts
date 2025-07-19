import { randomUUID } from "node:crypto";
import type Redis from "ioredis";
import type { Duration } from "pv-duration";
import type {
	LeakyBucketRateLimiter,
	LeakyBucketResult,
	LeakyBucketState,
} from "../algorithms/leakyBucket";

declare module "ioredis" {
	interface Redis {
		consumeLeakyBucket(
			key: string,
			capacity: number,
			requestId: string,
			interval: number,
		): Promise<[number, number]>;
		getStateLeakyBucket(
			key: string,
			capacity: number,
		): Promise<[number, number]>;
	}
}

const PREFIX = "leaky_bucket";

/**
 * A Redis-backed leaky bucket rate limiter, implemented as a capped queue.
 *
 * ## Algorithm Overview
 *
 * This implementation models a simple queue with a fixed capacity. Requests are
 * added to the queue if there is space. If the queue is full, new requests are
 * rejected. This approach does not include a "leak" mechanism to process
 * requests at a steady rate but serves as a basic overflow protection.
 *
 * ## How It Works
 *
 * 1. **Queue Check**: On a new request, the current length of the Redis list
 *    (acting as a queue) is checked.
 * 2. **Enqueue or Reject**: If the queue size is less than its capacity, the new
 *    request is added. Otherwise, it is rejected.
 * 3. **Atomicity**: A Lua script ensures that checking the queue size and adding
 *    a new request are performed as a single, atomic operation.
 *
 * @example
 * ```typescript
 * import Redis from 'ioredis';
 * import { LeakyBucketRateLimiter } from './leakyBucket';
 *
 * const redis = new Redis('redis://localhost:6379');
 *
 * // Create a bucket with a capacity of 20 requests
 * const rateLimiter = new LeakyBucketRateLimiter(redis, 20, 300);
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
export class IORedisLeakyBucketRateLimiter implements LeakyBucketRateLimiter {
	private redis: Redis;
	private capacity: number;
	/**
	 * In seconds
	 */
	private interval: number;

	constructor(redisClient: Redis, capacity: number, interval: Duration) {
		const intervalSeconds = interval.seconds;
		if (capacity <= 0 || intervalSeconds <= 0) {
			throw new Error("Capacity and interval must be positive values.");
		}

		this.redis = redisClient;
		this.capacity = capacity;
		this.interval = intervalSeconds;

		this.redis.defineCommand("consumeLeakyBucket", {
			numberOfKeys: 1,
			lua: `
        local key = KEYS[1]
        local capacity = tonumber(ARGV[1])
        local request_id = ARGV[2]
        local interval = tonumber(ARGV[3])

        local len = redis.call('LLEN', key)

        if len < capacity then
            redis.call('RPUSH', key, request_id)
            redis.call('EXPIRE', key, interval)
            return {1, capacity - (len + 1)}
        else
            return {0, 0}
        end
      `,
		});

		this.redis.defineCommand("getStateLeakyBucket", {
			numberOfKeys: 1,
			lua: `
        local key = KEYS[1]
        local capacity = tonumber(ARGV[1])

        local len = redis.call('LLEN', key)
        local remaining = capacity - len
        if remaining < 0 then
            remaining = 0
        end
        return {len, remaining}
      `,
		});
	}

	private getKey(key: string): string {
		return `${PREFIX}:${key}`;
	}

	/**
	 * Attempts to add a request to the bucket's queue.
	 * @param key A unique identifier for the client.
	 * @param uniqueRequestId An optional unique ID for the request.
	 * @returns A promise resolving to the result of the operation.
	 */
	public async consume(
		key: string,
		uniqueRequestId?: string,
	): Promise<LeakyBucketResult> {
		const redisKey = this.getKey(key);
		const requestId = uniqueRequestId || randomUUID();

		const [success, remaining] = await this.redis.consumeLeakyBucket(
			redisKey,
			this.capacity,
			requestId,
			this.interval,
		);

		return {
			success: success === 1,
			remaining: remaining,
		};
	}

	/**
	 * Retrieves the current state of the bucket (queue size and remaining capacity).
	 * @param key A unique identifier for the client.
	 * @returns A promise resolving to the bucket's state.
	 */
	public async getState(key: string): Promise<LeakyBucketState> {
		const redisKey = this.getKey(key);
		const [size, remaining] = await this.redis.getStateLeakyBucket(
			redisKey,
			this.capacity,
		);
		return { size, remaining };
	}

	public getCapacity(): number {
		return this.capacity;
	}
}
