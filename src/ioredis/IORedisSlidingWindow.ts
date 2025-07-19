import type Redis from "ioredis";
import type { Duration } from "pv-duration";
import type { SlidingWindowRateLimiter } from "../algorithms/slidingWindow";

declare module "ioredis" {
	interface Redis {
		consumeSlidingWindow(
			currentKey: string,
			previousKey: string,
			limit: number,
			interval: number,
			currentTime: number,
		): Promise<[number, number]>;
		getSlidingWindow(
			currentKey: string,
			previousKey: string,
			limit: number,
			interval: number,
			currentTime: number,
		): Promise<number>;
	}
}

export interface SlidingWindowResult {
	/** Indicates whether the request was successful. */
	success: boolean;
	/** The approximate number of requests remaining. */
	remaining: number;
}

const PREFIX = "sliding_window";

/**
 * A Redis-backed sliding window counter rate limiter.
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
 * 3. **Atomic Operations**: A Lua script performs all steps atomically: it fetches
 *    both counters, calculates the weighted rate, checks against the limit, and
 *    increments the current window's counter if the request is allowed.
 *
 * @example
 * ```typescript
 * import Redis from 'ioredis';
 * import { SlidingWindowRateLimiter } from './slidingWindow';
 *
 * const redis = new Redis('redis://localhost:6379');
 *
 * // Allows 50 requests per minute
 * const rateLimiter = new SlidingWindowRateLimiter(redis, 50, 60);
 *
 * const userId = 'user-123';
 *
 * const result = await rateLimiter.consume(userId);
 *
 * if (result.success) {
 *   console.log(`Request allowed. ~${result.remaining} requests remaining.`);
 * } else {
 *   console.log('Rate limit exceeded.');
 * }
 * ```
 */
export class IORedisSlidingWindowRateLimiter
	implements SlidingWindowRateLimiter
{
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

		const script = `
      local current_key = KEYS[1]
      local previous_key = KEYS[2]
      local limit = tonumber(ARGV[1])
      local interval = tonumber(ARGV[2])
      local current_time = tonumber(ARGV[3])

      local previous_count = redis.call('GET', previous_key)
      if not previous_count then
        previous_count = 0
      end
      previous_count = tonumber(previous_count)

      local time_in_window = current_time % interval
      local weight = (interval - time_in_window) / interval
      
      local weighted_count = math.floor(previous_count * weight)

      local current_count = redis.call('GET', current_key)
      if not current_count then
        current_count = 0
      end
      current_count = tonumber(current_count)

      local total_count = weighted_count + current_count
      local remaining = limit - total_count

      if total_count >= limit then
        if remaining < 0 then remaining = 0 end
        return {0, remaining}
      end
    `;

		this.redis.defineCommand("consumeSlidingWindow", {
			numberOfKeys: 2,
			lua:
				script +
				`
        local new_count = redis.call('INCR', current_key)
        if new_count == 1 then
          redis.call('EXPIRE', current_key, interval * 2)
        end
        
        remaining = remaining - 1
        if remaining < 0 then remaining = 0 end
        return {1, remaining}
      `,
		});

		this.redis.defineCommand("getSlidingWindow", {
			numberOfKeys: 2,
			lua:
				script +
				`
        if remaining < 0 then remaining = 0 end
        return remaining
      `,
		});
	}

	private getKeys(key: string): [string, string] {
		const now = Date.now() / 1000;
		const currentWindow = Math.floor(now / this.interval);
		const previousWindow = currentWindow - 1;
		const currentKey = `${PREFIX}:${key}:${currentWindow}`;
		const previousKey = `${PREFIX}:${key}:${previousWindow}`;
		return [currentKey, previousKey];
	}

	/**
	 * Attempts to consume a token for a given key.
	 * @param key A unique identifier for the client.
	 * @returns A promise resolving to the result of the operation.
	 */
	public async consume(key: string): Promise<SlidingWindowResult> {
		const [currentKey, previousKey] = this.getKeys(key);
		const now = Date.now() / 1000;

		const [success, remaining] = await this.redis.consumeSlidingWindow(
			currentKey,
			previousKey,
			this.limit,
			this.interval,
			now,
		);

		return {
			success: success === 1,
			remaining: Math.floor(remaining),
		};
	}

	/**
	 * Retrieves the approximate number of remaining requests for a given key.
	 * @param key A unique identifier for the client.
	 * @returns A promise resolving to the number of remaining requests.
	 */
	public async getRemaining(key: string): Promise<number> {
		const [currentKey, previousKey] = this.getKeys(key);
		const now = Date.now() / 1000;

		const remaining = await this.redis.getSlidingWindow(
			currentKey,
			previousKey,
			this.limit,
			this.interval,
			now,
		);
		return Math.floor(remaining);
	}

	public getLimit(): number {
		return this.limit;
	}

	public getInterval(): number {
		return this.interval;
	}
}
