import type Redis from "ioredis";
import type { Duration } from "pv-duration";
import type {
  FixedWindowRateLimiter,
  FixedWindowResult,
} from "../algorithms/fixedWindow";
import { getKey } from "../utils/key";

declare module "ioredis" {
  interface Redis {
    consumeFixedWindow(
      key: string,
      limit: number,
      interval: number
    ): Promise<[number, number]>;
    getFixedWindow(key: string, limit: number): Promise<number>;
  }
}

const PREFIX = "pvrl-fixed-window";

/**
 * A Redis-backed fixed window rate limiter.
 *
 * ## Algorithm Overview
 *
 * This algorithm divides time into fixed-size windows (e.g., one minute) and
 * assigns a counter to each window. Each request increments the counter for the
 * current window. If the counter exceeds the limit, further requests in that
 * window are rejected.
 *
 * ## How It Works
 *
 * 1. **Window Identification**: The current time is used to determine the
 *    active window. For example, if the interval is 60 seconds, all timestamps
 *    within the same minute belong to the same window.
 * 2. **Counting**: A Redis key is created using the user identifier and the
 *    current window timestamp.
 * 3. **Increment and Check**: On each request, the counter for the current window
 *    is atomically incremented. If the new count is above the limit, the request
 *    is denied.
 * 4. **Window Expiry**: Keys are automatically expired after the window duration
 *    to clean up old data.
 *
 * ## Key Benefits
 *
 * - **Simplicity**: Easy to implement and understand.
 * - **Atomicity**: Uses Lua scripts to ensure that checking and incrementing the
 *   limit are performed as a single, atomic operation.
 *
 * @example
 * ```typescript
 * import Redis from 'ioredis';
 * import { FixedWindowRateLimiter } from './fixedWindow';
 *
 * const redis = new Redis('redis://localhost:6379');
 *
 * // Allows 100 requests every 60 seconds
 * const rateLimiter = new FixedWindowRateLimiter(redis, 100, 60);
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
export class IORedisFixedWindowRateLimiter implements FixedWindowRateLimiter {
  private redis: Redis;
  private name: string;
  private limit: number;
  /**
   * In seconds
   */
  private interval: number;

  constructor(
    redisClient: Redis,
    name: string,
    limit: number,
    interval: Duration
  ) {
    const intervalSeconds = interval.seconds;
    if (limit <= 0 || intervalSeconds <= 0) {
      throw new Error("Limit and interval must be positive values.");
    }

    this.redis = redisClient;
    this.name = name;
    this.limit = limit;
    this.interval = intervalSeconds;

    this.redis.defineCommand("consumeFixedWindow", {
      numberOfKeys: 1,
      lua: `
        local key = KEYS[1]
        local limit = tonumber(ARGV[1])
        local interval = tonumber(ARGV[2])

        local count = redis.call('INCR', key)

        if count == 1 then
          redis.call('EXPIRE', key, interval)
        end

        local remaining = limit - count
        if remaining < 0 then
          remaining = 0
        end

        if count > limit then
          return {0, remaining}
        else
          return {1, remaining}
        end
      `,
    });

    this.redis.defineCommand("getFixedWindow", {
      numberOfKeys: 1,
      lua: `
          local key = KEYS[1]
          local limit = tonumber(ARGV[1])

          local count = redis.call('GET', key)
          if not count then
            count = 0
          end
          count = tonumber(count)

          local remaining = limit - count
          if remaining < 0 then
              remaining = 0
          end

          return remaining
        `,
    });
  }

  private getKey(key: string): string {
    const window = Math.floor(Date.now() / 1000 / this.interval);
    return `${getKey(PREFIX, this.name, key)}:${String(window)}`;
  }

  /**
   * Attempts to consume a token for a given key.
   * @param key A unique identifier for the client (e.g., user ID, IP address).
   * @returns A promise that resolves to an object indicating success and remaining tokens.
   */
  public async consume(key: string): Promise<FixedWindowResult> {
    const redisKey = this.getKey(key);

    const [success, remaining] = await this.redis.consumeFixedWindow(
      redisKey,
      this.limit,
      this.interval
    );

    return {
      success: success === 1,
      remaining: remaining,
    };
  }

  /**
   * Retrieves the number of remaining requests for a given key in the current window.
   * @param key A unique identifier for the client.
   * @returns A promise that resolves to the number of remaining requests.
   */
  public async getRemaining(key: string): Promise<number> {
    const redisKey = this.getKey(key);
    return this.redis.getFixedWindow(redisKey, this.limit);
  }

  /**
   * Returns the maximum number of requests allowed in a window.
   */
  public getLimit(): number {
    return this.limit;
  }

  /**
   * Returns the duration of the window in seconds.
   */
  public getInterval(): number {
    return this.interval;
  }
}
