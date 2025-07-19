import { randomUUID } from "node:crypto";
import type Redis from "ioredis";
import type { Duration } from "pv-duration";
import type {
	SlidingLogRateLimiter,
	SlidingLogResult,
} from "../algorithms/slidingLog";

declare module "ioredis" {
	interface Redis {
		consumeSlidingLog(
			key: string,
			limit: number,
			interval: number,
			currentTime: number,
			requestId: string,
		): Promise<[number, number]>;
		getSlidingLog(
			key: string,
			limit: number,
			interval: number,
			currentTime: number,
		): Promise<number>;
	}
}

const PREFIX = "sliding_log";

/**
 * A Redis-backed sliding log rate limiter.
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
 *    single atomic Lua script to prevent race conditions.
 *
 * ## Key Benefits
 *
 * - **High Accuracy**: Provides precise rate limiting without edge-case burst issues.
 * - **Fairness**: Ensures that the rate is maintained smoothly over time.
 *
 * @example
 * ```typescript
 * import Redis from 'ioredis';
 * import { SlidingLogRateLimiter } from './slidingLog';
 *
 * const redis = new Redis('redis://localhost:6379');
 *
 * // Allows 10 requests every 60 seconds
 * const rateLimiter = new SlidingLogRateLimiter(redis, 10, 60);
 *
 * const userId = 'user-123';
 *
 * const result = await rateLimiter.consume(userId);
 *
 * if (result.success) {
 *   console.log(`Request allowed. ${result.remaining} requests remaining.`);
 * } else {
 *   console.log('Rate limit exceeded.');
 * }
 * ```
 */
export class IORedisSlidingLogRateLimiter implements SlidingLogRateLimiter {
	private redis: Redis;
	private limit: number;
	/**
	 * In seconds
	 */
	private interval: number;

	constructor(redisClient: Redis, limit: number, interval: Duration) {
		const intervalSeconds = interval.seconds;
		if (limit <= 0 || intervalSeconds <= 0) {
			throw new Error("Limit and interval must be positive values.");
		}

		this.redis = redisClient;
		this.limit = limit;
		this.interval = intervalSeconds;

		this.redis.defineCommand("consumeSlidingLog", {
			numberOfKeys: 1,
			lua: `
          local key = KEYS[1]
          local limit = tonumber(ARGV[1])
          local interval = tonumber(ARGV[2])
          local current_time = tonumber(ARGV[3])
          local request_id = ARGV[4]
  
          -- Remove entries older than the current window
          local min_score = current_time - interval
          redis.call('ZREMRANGEBYSCORE', key, '-inf', min_score)
  
          -- Check the current count
          local count = redis.call('ZCARD', key)
  
          if count < limit then
            redis.call('ZADD', key, current_time, request_id)
            redis.call('EXPIRE', key, interval) -- Ensure the key expires
            return {1, limit - (count + 1)}
          else
            return {0, 0}
          end
        `,
		});

		this.redis.defineCommand("getSlidingLog", {
			numberOfKeys: 1,
			lua: `
          local key = KEYS[1]
          local limit = tonumber(ARGV[1])
          local interval = tonumber(ARGV[2])
          local current_time = tonumber(ARGV[3])
  
          -- Remove old entries to get an accurate count
          local min_score = current_time - interval
          redis.call('ZREMRANGEBYSCORE', key, '-inf', min_score)
  
          local count = redis.call('ZCARD', key)
          local remaining = limit - count

          if remaining < 0 then
            remaining = 0
          end
  
          return remaining
        `,
		});
	}

	private getKey(key: string): string {
		return `${PREFIX}:${key}`;
	}

	/**
	 * Attempts to consume a token for a given key.
	 * @param key A unique identifier for the client.
	 * @param uniqueRequestId An optional unique ID for the request.
	 * @returns A promise resolving to the result of the operation.
	 */
	public async consume(
		key: string,
		uniqueRequestId?: string,
	): Promise<SlidingLogResult> {
		const redisKey = this.getKey(key);
		const now = Date.now() / 1000;
		const requestId = uniqueRequestId || `${now}:${randomUUID()}`;

		const [success, remaining] = await this.redis.consumeSlidingLog(
			redisKey,
			this.limit,
			this.interval,
			now,
			requestId,
		);

		return {
			success: success === 1,
			remaining: remaining,
		};
	}

	/**
	 * Retrieves the number of remaining requests for a given key.
	 * @param key A unique identifier for the client.
	 * @returns A promise resolving to the number of remaining requests.
	 */
	public async getRemaining(key: string): Promise<number> {
		const redisKey = this.getKey(key);
		const now = Date.now() / 1000;
		return this.redis.getSlidingLog(redisKey, this.limit, this.interval, now);
	}

	public getLimit(): number {
		return this.limit;
	}

	public getInterval(): number {
		return this.interval;
	}
}
